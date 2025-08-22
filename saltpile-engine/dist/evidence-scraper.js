import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { delay, log } from './utils.js';
/**
 * Scrape additional article data from EvidenceAlerts pages
 */
export class EvidenceScraper {
    /**
     * Scrape article data from an EvidenceAlerts URL
     * Note: EvidenceAlerts requires authentication for full content access
     */
    async scrapeArticle(url) {
        let lastError;
        for (let attempt = 1; attempt <= EvidenceScraper.MAX_RETRIES; attempt++) {
            try {
                log(`Scraping attempt ${attempt}/${EvidenceScraper.MAX_RETRIES}: ${url}`);
                // Add delay to respect rate limits
                if (attempt > 1) {
                    await delay(EvidenceScraper.REQUEST_DELAY * attempt);
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), EvidenceScraper.TIMEOUT);
                // Handle redirects by following the redirect chain manually if needed
                let finalUrl = url;
                // Convert old plus.mcmaster.ca URLs to new evidencealerts.com format
                if (url.includes('plus.mcmaster.ca/EvidenceAlerts/LFE/Article')) {
                    const articleIdMatch = url.match(/\/(\d+)$/);
                    if (articleIdMatch) {
                        finalUrl = `https://www.evidencealerts.com/Articles/AlertedArticle/${articleIdMatch[1]}`;
                        log(`Converted URL from ${url} to ${finalUrl}`);
                    }
                }
                log(`Final URL being scraped: ${finalUrl}`);
                // Prepare headers with authentication cookies if available
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"'
                };
                // Add authentication cookies if available (for GitHub Actions)
                const evidenceCookies = process.env.EVIDENCE_ALERTS_COOKIES;
                if (evidenceCookies) {
                    headers['Cookie'] = evidenceCookies;
                    log('Using authentication cookies for EvidenceAlerts access');
                }
                else {
                    log('No authentication cookies available - may get login page');
                }
                const response = await fetch(finalUrl, {
                    headers,
                    signal: controller.signal,
                    redirect: 'follow'
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const html = await response.text();
                log(`HTML length received: ${html.length} chars`);
                log(`HTML preview: ${html.substring(0, 500)}...`);
                const scrapedData = this.parseEvidenceAlertsPage(html);
                log(`Successfully scraped data from: ${url}`);
                await delay(EvidenceScraper.REQUEST_DELAY); // Rate limiting
                return scrapedData;
            }
            catch (error) {
                lastError = error;
                log(`Scraping attempt ${attempt} failed: ${error.message}`, 'warn');
                if (attempt === EvidenceScraper.MAX_RETRIES) {
                    log(`All scraping attempts failed for: ${url}`, 'error');
                }
            }
        }
        throw lastError;
    }
    /**
     * Parse EvidenceAlerts page HTML to extract article data
     */
    parseEvidenceAlertsPage(html) {
        const $ = cheerio.load(html);
        const result = {};
        try {
            // Look for abstract text - EvidenceAlerts usually has specific selectors
            // This may need adjustment based on actual page structure
            // Try multiple selectors for abstract (updated for new EvidenceAlerts site)
            const abstractSelectors = [
                '#ArticleRecord > div:nth-child(2) > div.panel-body', // Specific EvidenceAlerts abstract location
                '#ArticleRecord .panel-body', // More general version
                '.panel-body', // Even more general
                '.abstract',
                '.article-abstract',
                '#abstract',
                '[data-abstract]',
                '.content .abstract',
                '.abstract-text',
                '.article-content .abstract',
                '.summary',
                '.article-summary',
                'div:contains("Abstract")',
                'p:contains("Abstract")',
                '[class*="abstract"]',
                '[id*="abstract"]',
                '.structured-abstract',
                '.unstructured-abstract'
            ];
            for (const selector of abstractSelectors) {
                const $abstract = $(selector);
                log(`Trying selector "${selector}": found ${$abstract.length} elements`);
                if ($abstract.length > 0) {
                    let abstractText = $abstract.text().trim();
                    log(`Text length for "${selector}": ${abstractText.length} chars`);
                    // Clean up abstract text
                    abstractText = abstractText
                        .replace(/^Abstract:?\s*/i, '') // Remove "Abstract:" prefix
                        .replace(/\s+/g, ' ') // Normalize whitespace
                        .trim();
                    if (abstractText.length > 50) { // Ensure we have substantial content
                        log(`Found abstract with "${selector}": ${abstractText.substring(0, 100)}...`);
                        result.abstract = abstractText;
                        break;
                    }
                    else if (abstractText.length > 0) {
                        log(`Text too short for "${selector}": "${abstractText}"`);
                    }
                }
            }
            // Look for PubMed link
            const pubmedSelectors = [
                'a[href*="pubmed.ncbi.nlm.nih.gov"]',
                'a[href*="ncbi.nlm.nih.gov/pubmed"]',
                'a:contains("PubMed")',
                'a:contains("PMID")'
            ];
            for (const selector of pubmedSelectors) {
                const $pubmedLink = $(selector);
                if ($pubmedLink.length > 0) {
                    const href = $pubmedLink.attr('href');
                    if (href && (href.includes('pubmed') || href.includes('PMID'))) {
                        result.pubmedUrl = href.startsWith('http') ? href : `https://pubmed.ncbi.nlm.nih.gov${href}`;
                        break;
                    }
                }
            }
            // Look for full title (sometimes different from email)
            const titleSelectors = [
                'h1',
                '.article-title',
                '.title',
                '[data-title]'
            ];
            for (const selector of titleSelectors) {
                const $title = $(selector);
                if ($title.length > 0) {
                    const titleText = $title.text().trim();
                    if (titleText.length > 10) { // Ensure we have substantial content
                        result.fullTitle = titleText;
                        break;
                    }
                }
            }
            // If no abstract found via selectors, try to find it in text content
            if (!result.abstract) {
                const pageText = $('body').text();
                // Try multiple patterns for abstract extraction
                const abstractPatterns = [
                    /Abstract:?\s*(.{100,2000}?)(?:\n\n|\r\n\r\n|Introduction|Methods|Results|Conclusion|Keywords|PMID)/i,
                    /Summary:?\s*(.{100,2000}?)(?:\n\n|\r\n\r\n|Introduction|Methods|Results|Conclusion|Keywords|PMID)/i,
                    /Background:?\s*(.{100,2000}?)(?:\n\n|\r\n\r\n|Methods|Results|Conclusion|Keywords|PMID)/i
                ];
                for (const pattern of abstractPatterns) {
                    const match = pageText.match(pattern);
                    if (match) {
                        result.abstract = match[1].trim().replace(/\s+/g, ' ');
                        break;
                    }
                }
                // If still no abstract, try looking for any substantial paragraph that might be the abstract
                // But exclude footer content and contact information
                if (!result.abstract) {
                    const paragraphs = $('p').not('footer p').not('.footer p').toArray();
                    for (const p of paragraphs) {
                        const text = $(p).text().trim();
                        if (text.length > 200 && text.length < 2000 &&
                            !text.includes('©') &&
                            !text.includes('login') &&
                            !text.includes('McMaster University') &&
                            !text.includes('Hamilton, Ontario') &&
                            !text.includes('Communications Research Lab')) {
                            result.abstract = text;
                            break;
                        }
                    }
                }
            }
        }
        catch (error) {
            log(`Error parsing EvidenceAlerts page: ${error.message}`, 'warn');
        }
        return result;
    }
    /**
     * Test scraping functionality with a known URL
     */
    async testScraping(testUrl) {
        const url = testUrl || 'https://plus.mcmaster.ca/EvidenceAlerts/';
        try {
            log(`Testing scraping with URL: ${url}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), EvidenceScraper.TIMEOUT);
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                log('Scraping test successful - can connect to EvidenceAlerts');
                return true;
            }
            else {
                log(`Scraping test failed: HTTP ${response.status}`, 'error');
                return false;
            }
        }
        catch (error) {
            log(`Scraping test failed: ${error.message}`, 'error');
            return false;
        }
    }
    /**
     * Batch scrape multiple articles with rate limiting
     */
    async scrapeMultipleArticles(urls) {
        const results = new Map();
        log(`Starting batch scraping of ${urls.length} articles`);
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                log(`Scraping ${i + 1}/${urls.length}: ${url}`);
                const data = await this.scrapeArticle(url);
                results.set(url, data);
                // Progress logging
                if ((i + 1) % 5 === 0 || i === urls.length - 1) {
                    log(`Batch scraping progress: ${i + 1}/${urls.length} completed`);
                }
            }
            catch (error) {
                log(`Failed to scrape ${url}: ${error.message}`, 'error');
                // Continue with other URLs even if one fails
                results.set(url, {}); // Empty data for failed scrapes
            }
        }
        log(`Batch scraping completed: ${results.size}/${urls.length} articles processed`);
        return results;
    }
}
EvidenceScraper.REQUEST_DELAY = 1000; // 1 second between requests
EvidenceScraper.MAX_RETRIES = 3;
EvidenceScraper.TIMEOUT = 10000; // 10 seconds
