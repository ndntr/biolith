#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { RSSFetcher } from './rss-fetcher.js';
import { parseEmailFile } from './email-parser.js';
import { EvidenceScraper } from './evidence-scraper.js';
import { PubMedFetcher } from './pubmed-fetcher.js';
import { generateBatchEvidenceSummaries } from './ai-summarizer.js';
import { generateArticleId, generateArticleIds, isArticleNew, log } from './utils.js';
import { areTitlesSimilar } from './deduplication.js';
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
        // Generate AI summaries for articles that have abstracts
        log('Generating AI summaries...');
        const articlesWithAbstracts = evidenceArticles.filter(article => article.abstract || article.structuredAbstract);
        if (articlesWithAbstracts.length > 0) {
            await generateBatchEvidenceSummaries(articlesWithAbstracts);
        }
        else {
            log('No articles with abstracts found, skipping summary generation');
        }
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
        // Create a map for deduplication using normalized IDs
        const normalizedMap = new Map();
        const idToNormalizedId = new Map();
        // Process existing articles
        existingData.articles.forEach(article => {
            const { normalizedId } = generateArticleIds(article.title, article.journal);
            idToNormalizedId.set(article.id, normalizedId);
            // Keep the best version of duplicates (prefer articles with abstracts)
            const existing = normalizedMap.get(normalizedId);
            if (!existing ||
                (!existing.abstract && article.abstract) ||
                (!existing.pubmedUrl && article.pubmedUrl)) {
                normalizedMap.set(normalizedId, article);
            }
        });
        // Process new articles with fuzzy matching
        let duplicatesFound = 0;
        newArticles.forEach(newArticle => {
            const { normalizedId } = generateArticleIds(newArticle.title, newArticle.journal);
            // Check for duplicates using normalized ID
            const existing = normalizedMap.get(normalizedId);
            if (existing) {
                // Update existing article if new one has more data
                if (!existing.abstract && newArticle.abstract) {
                    normalizedMap.set(normalizedId, newArticle);
                    duplicatesFound++;
                    log(`Updated duplicate article with abstract: "${newArticle.title}"`, 'info');
                }
                else if (!existing.pubmedUrl && newArticle.pubmedUrl) {
                    normalizedMap.set(normalizedId, newArticle);
                    duplicatesFound++;
                    log(`Updated duplicate article with PubMed URL: "${newArticle.title}"`, 'info');
                }
                else {
                    duplicatesFound++;
                    log(`Skipped duplicate article: "${newArticle.title}"`, 'info');
                }
            }
            else {
                // Check for fuzzy matches with existing articles
                let foundFuzzyMatch = false;
                for (const [existingNormId, existingArticle] of normalizedMap) {
                    if (existingArticle.journal === newArticle.journal &&
                        areTitlesSimilar(existingArticle.title, newArticle.title, 0.85)) {
                        foundFuzzyMatch = true;
                        duplicatesFound++;
                        log(`Found fuzzy duplicate: "${newArticle.title}" matches "${existingArticle.title}"`, 'info');
                        // Update if new article has more complete data
                        if (!existingArticle.abstract && newArticle.abstract) {
                            normalizedMap.set(existingNormId, newArticle);
                        }
                        break;
                    }
                }
                if (!foundFuzzyMatch) {
                    normalizedMap.set(normalizedId, newArticle);
                }
            }
        });
        if (duplicatesFound > 0) {
            log(`🔍 Deduplicated ${duplicatesFound} articles`, 'info');
        }
        // Convert map back to array
        existingData.articles = Array.from(normalizedMap.values());
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
