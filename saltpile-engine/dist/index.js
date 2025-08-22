#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { RSSFetcher } from './rss-fetcher.js';
import { parseEmailFile } from './email-parser.js';
import { EvidenceScraper } from './evidence-scraper.js';
import { PubMedFetcher } from './pubmed-fetcher.js';
import { generateArticleId, isArticleNew, log } from './utils.js';
class SaltpileEngine {
    constructor(options = {}) {
        this.options = options;
        this.scraper = new EvidenceScraper();
        this.pubmedFetcher = new PubMedFetcher();
        // Initialize RSS fetcher if not in test mode or scrape-only mode
        if (!options.testMode && !options.scrapeOnly) {
            const rssUrl = process.env.EVIDENCE_ALERTS_RSS_URL;
            if (!rssUrl) {
                throw new Error('EVIDENCE_ALERTS_RSS_URL environment variable is required');
            }
            this.rssFetcher = new RSSFetcher(rssUrl);
            log('Using RSS feed from Kill the Newsletter');
        }
    }
    /**
     * Main processing pipeline
     */
    async process() {
        try {
            log('🧂 Saltpile Engine starting...');
            // Handle different modes
            if (this.options.fetchOnly) {
                await this.testRSSFetching();
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
            const articles = await this.processArticles();
            await this.saveEvidenceData(articles);
            log(`✅ Processing complete: ${articles.length} articles processed`);
        }
        catch (error) {
            log(`❌ Processing failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }
    /**
     * Process articles from RSS feed
     */
    async processArticles() {
        let articles;
        if (this.options.testMode) {
            // Test mode with local email file
            const testPath = this.options.testEmailPath || './test-email.eml';
            log(`Using test email file: ${testPath}`);
            if (!fs.existsSync(testPath)) {
                throw new Error(`Test email file not found: ${testPath}`);
            }
            articles = await parseEmailFile(testPath);
        }
        else {
            // Production mode - fetch from RSS feed
            log('Fetching latest articles from RSS feed...');
            if (!this.rssFetcher) {
                throw new Error('RSS fetcher not initialized');
            }
            articles = await this.rssFetcher.fetchLatestEvidenceArticles();
            if (articles.length === 0) {
                log('No articles found in RSS feed');
                return [];
            }
        }
        if (articles.length === 0) {
            log('No articles found');
            return [];
        }
        log(`Found ${articles.length} articles`);
        // Fetch abstracts from PubMed
        const searchParams = articles.map(article => ({
            title: article.title,
            journal: article.journal
        }));
        log('Fetching abstracts from PubMed...');
        const pubmedResults = await this.pubmedFetcher.fetchMultipleAbstracts(searchParams);
        // Combine article data with PubMed data
        const evidenceArticles = articles.map(article => {
            const pubmedData = pubmedResults.get(article.title);
            const dateReceived = new Date().toISOString();
            // Build PubMed URL if we have PMID
            let pubmedUrl;
            if (pubmedData?.pmid) {
                pubmedUrl = `https://pubmed.ncbi.nlm.nih.gov/${pubmedData.pmid}/`;
            }
            return {
                id: generateArticleId(article.title, article.journal),
                title: article.title, // Always use the article title
                journal: article.journal,
                score: article.score,
                tags: article.tags,
                evidenceAlertsUrl: article.evidenceAlertsUrl,
                abstract: pubmedData?.abstract,
                structuredAbstract: pubmedData?.structuredAbstract,
                pubmedUrl,
                pubDate: pubmedData?.pubDate,
                doi: pubmedData?.doi,
                dateReceived,
                isNew: true // All articles from today's email are new
            };
        });
        return evidenceArticles;
    }
    /**
     * Save evidence data to JSON file
     */
    async saveEvidenceData(newArticles) {
        const dataDir = path.join(process.cwd(), 'data');
        const dataPath = path.join(dataDir, 'evidence.json');
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Load existing data if it exists
        let existingData = {
            updated_at: new Date().toISOString(),
            articles: []
        };
        if (fs.existsSync(dataPath)) {
            try {
                const existingContent = fs.readFileSync(dataPath, 'utf-8');
                existingData = JSON.parse(existingContent);
            }
            catch (error) {
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
        // Update existing articles or add new ones
        const articleMap = new Map();
        // First add existing articles to the map
        existingData.articles.forEach(article => {
            articleMap.set(article.id, article);
        });
        // Then add/update with new articles (overwrites existing if ID matches)
        newArticles.forEach(article => {
            articleMap.set(article.id, article);
        });
        // Convert map back to array
        existingData.articles = Array.from(articleMap.values());
        existingData.updated_at = new Date().toISOString();
        // Sort articles by date (newest first)
        existingData.articles.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
        // Limit to 50 articles maximum
        existingData.articles = existingData.articles.slice(0, 50);
        // Save to file
        fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));
        log(`💾 Evidence data saved: ${dataPath} (${existingData.articles.length} articles total)`);
    }
    /**
     * Test RSS feed fetching functionality
     */
    async testRSSFetching() {
        if (!this.rssFetcher) {
            throw new Error('RSS fetcher not available in test mode');
        }
        log('Testing RSS feed connection...');
        const connectionOk = await this.rssFetcher.testConnection();
        if (!connectionOk) {
            throw new Error('RSS feed connection test failed');
        }
        log('Getting RSS feed info...');
        const feedInfo = await this.rssFetcher.getFeedInfo();
        log(`✅ RSS fetch test successful: ${feedInfo.itemCount} items found`);
        if (feedInfo.title) {
            log(`   Feed title: ${feedInfo.title}`);
        }
    }
    /**
     * Test email parsing functionality
     */
    async testEmailParsing() {
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
    async testScraping() {
        log('Testing PubMed API functionality...');
        const success = await this.pubmedFetcher.testConnection();
        if (!success) {
            throw new Error('PubMed API test failed');
        }
        log('✅ PubMed API test successful');
        // Test with a real article from our email
        log('Testing abstract fetch with sample article...');
        const testResult = await this.pubmedFetcher.fetchArticleAbstract({
            title: 'Alteplase for Acute Ischemic Stroke at 4.5 to 24 Hours: The HOPE Randomized Clinical Trial',
            journal: 'JAMA'
        });
        if (testResult && testResult.abstract) {
            log(`✅ Successfully fetched abstract (${testResult.abstract.length} chars)`);
            log(`   PMID: ${testResult.pmid}`);
        }
        else {
            log('⚠️ Could not fetch abstract for test article', 'warn');
        }
    }
}
// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const options = {};
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
    }
    catch (error) {
        log(`Fatal error: ${error.message}`, 'error');
        process.exit(1);
    }
}
// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
export { SaltpileEngine };
