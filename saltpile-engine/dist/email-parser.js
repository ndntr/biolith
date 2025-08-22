import fs from 'fs';
import * as cheerio from 'cheerio';
import { cleanText, log } from './utils.js';
/**
 * Parse an .eml file and extract evidence articles
 * Simplified version for test mode only
 */
export async function parseEmailFile(emailPath) {
    try {
        log(`Parsing email file: ${emailPath}`);
        const emailContent = fs.readFileSync(emailPath, 'utf-8');
        // Simple extraction - assume the file contains HTML content
        return extractArticlesFromHtml(emailContent);
    }
    catch (error) {
        log(`Error parsing email file: ${error.message}`, 'error');
        throw error;
    }
}
/**
 * Parse email content buffer and extract evidence articles
 * Simplified version for test mode only
 */
export async function parseEmailBuffer(emailBuffer) {
    try {
        log('Parsing email buffer');
        const emailContent = emailBuffer.toString('utf-8');
        return extractArticlesFromHtml(emailContent);
    }
    catch (error) {
        log(`Error parsing email buffer: ${error.message}`, 'error');
        throw error;
    }
}
/**
 * Extract articles from HTML content
 * Used by both RSS fetcher and email parser (test mode)
 */
/**
 * Extract articles from HTML content using cheerio
 * Simplified version for PubMed API lookup - only extracts title, journal, and tags
 */
export function extractArticlesFromHtml(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const articles = [];
    log('Scanning HTML for article data');
    // Find all article links (don't require specific table structure)
    const $articleLinks = $('a[href*="plus.mcmaster.ca/EvidenceAlerts/LFE/Article"]');
    if ($articleLinks.length === 0) {
        log('No EvidenceAlerts article links found', 'warn');
        return articles;
    }
    log(`Found ${$articleLinks.length} article links in content`);
    $articleLinks.each((index, element) => {
        try {
            const $link = $(element);
            const evidenceAlertsUrl = $link.attr('href');
            // The title is the link text
            const title = cleanText($link.text());
            if (!title) {
                log(`No title found for article ${index + 1}`, 'warn');
                return;
            }
            // Find the containing row for this article
            const $articleRow = $link.closest('tr');
            if ($articleRow.length === 0) {
                log(`No row found for article: ${title}`, 'warn');
                return;
            }
            // Look in the next few rows for journal, score, and tags
            let journal = '';
            let score = '';
            let tags = [];
            // Check the next 3 rows after the title for article data
            let $currentRow = $articleRow.next('tr');
            for (let i = 0; i < 3 && $currentRow.length > 0; i++) {
                const $cells = $currentRow.find('td');
                const rowText = cleanText($currentRow.text());
                // Journal and score row: first cell has journal, second cell has score image
                if ($cells.length >= 2 && !rowText.includes('Tagged for:')) {
                    const firstCellText = cleanText($cells.eq(0).text());
                    if (firstCellText && firstCellText.length > 0 && firstCellText !== '--') {
                        journal = firstCellText;
                    }
                    // Score is in the img alt attribute
                    const $scoreImg = $cells.eq(1).find('img[alt*="Score:"]');
                    if ($scoreImg.length > 0) {
                        const altText = $scoreImg.attr('alt') || '';
                        const scoreMatch = altText.match(/Score:\s*(\d+\/\d+)/);
                        if (scoreMatch) {
                            score = scoreMatch[1];
                        }
                    }
                }
                // Tags row: contains "Tagged for:"
                if (rowText.includes('Tagged for:')) {
                    // Extract tags after "Tagged for:"
                    const tagText = rowText.replace('Tagged for:', '').trim();
                    if (tagText) {
                        tags = tagText.split(',').map(tag => cleanText(tag)).filter(tag => tag.length > 0);
                    }
                }
                $currentRow = $currentRow.next('tr');
            }
            // Create article data (URL optional since we use PubMed API)
            const article = {
                title,
                journal: journal || 'Unknown',
                score: score || '',
                tags,
                evidenceAlertsUrl: evidenceAlertsUrl || ''
            };
            articles.push(article);
            log(`Extracted article: ${title} (${journal}) - Score: ${score}`);
        }
        catch (error) {
            log(`Error processing article ${index + 1}: ${error.message}`, 'error');
        }
    });
    log(`Successfully extracted ${articles.length} articles from content`);
    return articles;
}
