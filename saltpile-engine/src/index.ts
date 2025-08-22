#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { EmailFetcher } from './email-fetcher.js';
import { parseEmailFile, parseEmailBuffer } from './email-parser.js';
import { EvidenceScraper } from './evidence-scraper.js';
import { EvidenceArticle, EvidenceData, ProcessingOptions } from './types.js';
import { generateArticleId, isArticleNew, log } from './utils.js';

class SaltpileEngine {
  private emailFetcher?: EmailFetcher;
  private scraper: EvidenceScraper;
  private options: ProcessingOptions;

  constructor(options: ProcessingOptions = {}) {
    this.options = options;
    this.scraper = new EvidenceScraper();

    // Initialize email fetcher if not in test mode or scrape-only mode
    if (!options.testMode && !options.scrapeOnly) {
      const email = process.env.INGEST_MAIL;
      const password = process.env.INGEST_MAIL_KEY;

      if (!email || !password) {
        throw new Error('INGEST_MAIL and INGEST_MAIL_KEY environment variables are required');
      }

      this.emailFetcher = new EmailFetcher(email, password);
    }
  }

  /**
   * Main processing pipeline
   */
  async process(): Promise<void> {
    try {
      log('🧂 Saltpile Engine starting...');

      // Handle different modes
      if (this.options.fetchOnly) {
        await this.testEmailFetching();
        return;
      }

      if (this.options.parseOnly) {
        await this.testEmailParsing();
        return;
      }

      if (this.options.scrapeOnly) {
        await this.testScraping();
        return;
      }

      // Full processing pipeline
      const articles = await this.processEmails();
      await this.saveEvidenceData(articles);
      
      log(`✅ Processing complete: ${articles.length} articles processed`);

    } catch (error) {
      log(`❌ Processing failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  /**
   * Process emails and extract articles
   */
  private async processEmails(): Promise<EvidenceArticle[]> {
    let emailArticles;

    if (this.options.testMode) {
      // Test mode with local email file
      const testPath = this.options.testEmailPath || './test-email.eml';
      log(`Using test email file: ${testPath}`);
      
      if (!fs.existsSync(testPath)) {
        throw new Error(`Test email file not found: ${testPath}`);
      }

      emailArticles = await parseEmailFile(testPath);
    } else {
      // Production mode - fetch from Gmail
      log('Fetching latest email from Gmail...');
      
      if (!this.emailFetcher) {
        throw new Error('Email fetcher not initialized');
      }

      const emailBuffer = await this.emailFetcher.fetchLatestEvidenceEmail();
      
      if (!emailBuffer) {
        log('No new emails found');
        return [];
      }

      emailArticles = await parseEmailBuffer(emailBuffer);
    }

    if (emailArticles.length === 0) {
      log('No articles found in email');
      return [];
    }

    log(`Found ${emailArticles.length} articles in email`);

    // Scrape additional data for each article
    const urls = emailArticles.map(article => article.evidenceAlertsUrl);
    const scrapedData = await this.scraper.scrapeMultipleArticles(urls);

    // Combine email data with scraped data
    const evidenceArticles: EvidenceArticle[] = emailArticles.map(emailArticle => {
      const scraped = scrapedData.get(emailArticle.evidenceAlertsUrl) || {};
      const dateReceived = new Date().toISOString();

      return {
        id: generateArticleId(emailArticle.title, emailArticle.journal),
        title: emailArticle.title, // Always use the email title, which is more reliable
        journal: emailArticle.journal,
        score: emailArticle.score,
        tags: emailArticle.tags,
        evidenceAlertsUrl: emailArticle.evidenceAlertsUrl,
        abstract: scraped.abstract,
        pubmedUrl: scraped.pubmedUrl,
        dateReceived,
        isNew: true  // All articles from today's email are new
      };
    });

    return evidenceArticles;
  }

  /**
   * Save evidence data to JSON file
   */
  private async saveEvidenceData(newArticles: EvidenceArticle[]): Promise<void> {
    const dataDir = path.join(process.cwd(), 'data');
    const dataPath = path.join(dataDir, 'evidence.json');

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing data if it exists
    let existingData: EvidenceData = {
      updated_at: new Date().toISOString(),
      articles: []
    };

    if (fs.existsSync(dataPath)) {
      try {
        const existingContent = fs.readFileSync(dataPath, 'utf-8');
        existingData = JSON.parse(existingContent);
      } catch (error) {
        log(`Warning: Could not parse existing evidence.json: ${error.message}`, 'warn');
      }
    }

    // Update isNew flag for existing articles (older than 24 hours)
    existingData.articles.forEach(article => {
      article.isNew = isArticleNew(article.dateReceived);
    });

    // Remove articles older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    existingData.articles = existingData.articles.filter(article => {
      const articleDate = new Date(article.dateReceived);
      return articleDate >= sevenDaysAgo;
    });

    // Add new articles (avoid duplicates by ID)
    const existingIds = new Set(existingData.articles.map(a => a.id));
    const uniqueNewArticles = newArticles.filter(a => !existingIds.has(a.id));

    existingData.articles = [...uniqueNewArticles, ...existingData.articles];
    existingData.updated_at = new Date().toISOString();

    // Sort articles by date (newest first)
    existingData.articles.sort((a, b) => 
      new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime()
    );

    // Limit to 50 articles maximum
    existingData.articles = existingData.articles.slice(0, 50);

    // Save to file
    fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));
    log(`💾 Evidence data saved: ${dataPath} (${existingData.articles.length} articles total)`);
  }

  /**
   * Test email fetching functionality
   */
  private async testEmailFetching(): Promise<void> {
    if (!this.emailFetcher) {
      throw new Error('Email fetcher not available in test mode');
    }

    log('Testing email connection...');
    const connectionOk = await this.emailFetcher.testConnection();
    
    if (!connectionOk) {
      throw new Error('Email connection test failed');
    }

    log('Getting unread email count...');
    const count = await this.emailFetcher.getUnreadEmailCount();
    log(`✅ Email fetch test successful: ${count} unread emails found`);
  }

  /**
   * Test email parsing functionality
   */
  private async testEmailParsing(): Promise<void> {
    const testPath = this.options.testEmailPath || './test-email.eml';
    
    if (!fs.existsSync(testPath)) {
      throw new Error(`Test email file not found: ${testPath}`);
    }

    log(`Testing email parsing with: ${testPath}`);
    const articles = await parseEmailFile(testPath);
    
    log(`✅ Email parsing test successful: ${articles.length} articles extracted`);
    articles.forEach((article, index) => {
      log(`  ${index + 1}. ${article.title} (${article.journal})`);
    });
  }

  /**
   * Test scraping functionality
   */
  private async testScraping(): Promise<void> {
    log('Testing web scraping functionality...');
    const success = await this.scraper.testScraping();
    
    if (!success) {
      throw new Error('Scraping test failed');
    }

    log('✅ Scraping test successful');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const options: ProcessingOptions = {};

  // Parse command line arguments
  if (args.includes('--test-local')) {
    options.testMode = true;
    options.testEmailPath = args.includes('--email-path') 
      ? args[args.indexOf('--email-path') + 1] 
      : undefined;
  }

  if (args.includes('--test-fetch')) {
    options.fetchOnly = true;
  }

  if (args.includes('--test-parse')) {
    options.parseOnly = true;
    options.testMode = true;
  }

  if (args.includes('--test-scrape')) {
    options.scrapeOnly = true;
  }

  try {
    const engine = new SaltpileEngine(options);
    await engine.process();
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SaltpileEngine };