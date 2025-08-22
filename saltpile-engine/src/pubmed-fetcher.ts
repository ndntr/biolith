import axios from 'axios';
import * as xml2js from 'xml2js';
import https from 'https';
import { log, delay } from './utils.js';

interface PubMedSearchResult {
  pmid: string;
  title?: string;
  abstract?: string;
  journal?: string;
  authors?: string[];
  pubDate?: string;
  doi?: string;
}

interface SearchParams {
  title: string;
  journal?: string;
  year?: number;
}

/**
 * Fetches article abstracts from PubMed using NCBI E-utilities API
 */
export class PubMedFetcher {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  private readonly requestDelay = 100; // 100ms between requests (10/second with API key)
  private readonly maxRetries = 3;
  private readonly httpsAgent: https.Agent;

  constructor() {
    this.apiKey = process.env.NCBI_KEY;
    if (!this.apiKey) {
      log('Warning: NCBI_KEY not found. API rate limits will be lower (3 req/sec)', 'warn');
    }
    
    // Create HTTPS agent that forces IPv4 (fixes timeout issues)
    this.httpsAgent = new https.Agent({
      family: 4,  // Force IPv4
      timeout: 10000
    });
  }

  /**
   * Search PubMed for an article and fetch its abstract
   */
  async fetchArticleAbstract(params: SearchParams): Promise<PubMedSearchResult | null> {
    try {
      // Step 1: Search for the article
      const pmids = await this.searchArticle(params);
      
      if (!pmids || pmids.length === 0) {
        log(`No PubMed results found for: ${params.title}`, 'warn');
        return null;
      }

      // Step 2: Fetch article details including abstract
      const article = await this.fetchArticleDetails(pmids[0]);
      
      if (article) {
        log(`Successfully fetched abstract for PMID ${pmids[0]}`);
      }
      
      return article;

    } catch (error) {
      log(`Error fetching from PubMed: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Search PubMed for articles matching the given criteria
   */
  private async searchArticle(params: SearchParams): Promise<string[]> {
    // Clean and normalize the title for better matching
    const cleanTitle = params.title
      .replace(/\.$/, '')  // Remove trailing period
      .replace(/[:\-]/g, ' ')  // Replace colons and hyphens with spaces
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();
    
    // Build search query - use looser matching for better results
    let query = `${cleanTitle}`;
    
    if (params.journal) {
      // Clean journal name for search
      const cleanJournal = params.journal
        .replace(/\./g, '')  // Remove periods
        .replace(/\s+/g, ' '); // Normalize spaces
      query += ` AND "${cleanJournal}"[Journal]`;
    }

    if (params.year) {
      query += ` AND ${params.year}[pdat]`;
    }

    const searchUrl = new URL(`${this.baseUrl}/esearch.fcgi`);
    searchUrl.searchParams.append('db', 'pubmed');
    searchUrl.searchParams.append('term', query);
    searchUrl.searchParams.append('retmode', 'json');
    searchUrl.searchParams.append('retmax', '5');
    
    if (this.apiKey) {
      searchUrl.searchParams.append('api_key', this.apiKey);
    }

    log(`PubMed search query: ${query}`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await delay(this.requestDelay * attempt);
        }

        const response = await axios.get(searchUrl.toString(), {
          httpsAgent: this.httpsAgent,
          timeout: 10000,
          headers: {
            'User-Agent': 'saltpile-engine/1.0'
          }
        });

        const data = response.data;
        
        if (data.esearchresult && data.esearchresult.idlist) {
          return data.esearchresult.idlist;
        }

        return [];

      } catch (error) {
        log(`Search attempt ${attempt}/${this.maxRetries} failed: ${error.message}`, 'warn');
        if (attempt === this.maxRetries) {
          throw error;
        }
      }
    }

    return [];
  }

  /**
   * Fetch detailed article information including abstract
   */
  private async fetchArticleDetails(pmid: string): Promise<PubMedSearchResult | null> {
    const fetchUrl = new URL(`${this.baseUrl}/efetch.fcgi`);
    fetchUrl.searchParams.append('db', 'pubmed');
    fetchUrl.searchParams.append('id', pmid);
    fetchUrl.searchParams.append('retmode', 'xml');
    fetchUrl.searchParams.append('rettype', 'abstract');
    
    if (this.apiKey) {
      fetchUrl.searchParams.append('api_key', this.apiKey);
    }

    log(`Fetching details for PMID: ${pmid}`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await delay(this.requestDelay * attempt);
        }

        const response = await axios.get(fetchUrl.toString(), {
          httpsAgent: this.httpsAgent,
          timeout: 10000,
          headers: {
            'User-Agent': 'saltpile-engine/1.0'
          }
        });

        const xmlData = response.data;
        const article = await this.parseArticleXml(xmlData, pmid);
        
        // Add delay to respect rate limits
        await delay(this.requestDelay);
        
        return article;

      } catch (error) {
        log(`Fetch attempt ${attempt}/${this.maxRetries} failed: ${error.message}`, 'warn');
        if (attempt === this.maxRetries) {
          throw error;
        }
      }
    }

    return null;
  }

  /**
   * Parse PubMed XML response to extract article data
   */
  private async parseArticleXml(xmlData: string, pmid: string): Promise<PubMedSearchResult | null> {
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: true
      });

      const result = await parser.parseStringPromise(xmlData);
      
      if (!result.PubmedArticleSet || !result.PubmedArticleSet.PubmedArticle) {
        return null;
      }

      const article = result.PubmedArticleSet.PubmedArticle;
      const medlineCitation = article.MedlineCitation;
      
      if (!medlineCitation) {
        return null;
      }

      const articleData = medlineCitation.Article;
      
      // Extract abstract text
      let abstractText = '';
      if (articleData.Abstract) {
        if (typeof articleData.Abstract.AbstractText === 'string') {
          abstractText = articleData.Abstract.AbstractText;
        } else if (Array.isArray(articleData.Abstract.AbstractText)) {
          // Structured abstract with multiple sections
          abstractText = articleData.Abstract.AbstractText
            .map((section: any) => {
              if (typeof section === 'string') {
                return section;
              } else if (section._ ) {
                // XML element with text content
                return section._;
              }
              return '';
            })
            .filter((text: string) => text.length > 0)
            .join(' ');
        } else if (articleData.Abstract.AbstractText._) {
          // XML element with text content
          abstractText = articleData.Abstract.AbstractText._;
        }
      }

      // Extract other metadata
      const title = articleData.ArticleTitle || '';
      const journal = articleData.Journal?.Title || '';
      
      // Extract authors
      const authors: string[] = [];
      if (articleData.AuthorList && articleData.AuthorList.Author) {
        const authorList = Array.isArray(articleData.AuthorList.Author) 
          ? articleData.AuthorList.Author 
          : [articleData.AuthorList.Author];
        
        for (const author of authorList) {
          if (author.LastName && author.ForeName) {
            authors.push(`${author.ForeName} ${author.LastName}`);
          }
        }
      }

      // Extract DOI if available
      let doi = '';
      if (article.PubmedData && article.PubmedData.ArticleIdList) {
        const idList = Array.isArray(article.PubmedData.ArticleIdList.ArticleId)
          ? article.PubmedData.ArticleIdList.ArticleId
          : [article.PubmedData.ArticleIdList.ArticleId];
        
        const doiObj = idList.find((id: any) => id.IdType === 'doi');
        if (doiObj && doiObj._) {
          doi = doiObj._;
        }
      }

      return {
        pmid,
        title,
        abstract: abstractText,
        journal,
        authors,
        doi
      };

    } catch (error) {
      log(`Error parsing PubMed XML: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Batch fetch abstracts for multiple articles
   */
  async fetchMultipleAbstracts(articles: SearchParams[]): Promise<Map<string, PubMedSearchResult>> {
    const results = new Map<string, PubMedSearchResult>();
    
    log(`Starting batch fetch for ${articles.length} articles from PubMed`);

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      try {
        log(`Fetching ${i + 1}/${articles.length}: ${article.title}`);
        const result = await this.fetchArticleAbstract(article);
        
        if (result) {
          results.set(article.title, result);
        }
        
        // Progress logging
        if ((i + 1) % 5 === 0 || i === articles.length - 1) {
          log(`PubMed fetch progress: ${i + 1}/${articles.length} completed`);
        }
        
      } catch (error) {
        log(`Failed to fetch abstract for "${article.title}": ${error.message}`, 'error');
      }
    }

    log(`PubMed batch fetch completed: ${results.size}/${articles.length} articles with abstracts`);
    return results;
  }

  /**
   * Test PubMed connection and API key
   */
  async testConnection(): Promise<boolean> {
    try {
      log('Testing PubMed API connection...');
      
      // Try a simple search
      const testParams: SearchParams = {
        title: 'COVID-19',
        year: 2024
      };
      
      const pmids = await this.searchArticle(testParams);
      
      if (pmids && pmids.length > 0) {
        log(`PubMed connection test successful. Found ${pmids.length} test results.`);
        if (this.apiKey) {
          log('API key is configured correctly.');
        }
        return true;
      }
      
      log('PubMed connection test: No results found but connection works.', 'warn');
      return true;
      
    } catch (error) {
      log(`PubMed connection test failed: ${error.message}`, 'error');
      return false;
    }
  }
}