import { XMLParser } from 'fast-xml-parser';
import { log } from './utils.js';
import { extractArticlesFromHtml } from './email-parser.js';
/**
 * Fetch and parse RSS feed from Kill the Newsletter
 */
export class RSSFetcher {
    constructor(rssUrl) {
        this.rssUrl = rssUrl;
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            parseAttributeValue: true,
            trimValues: true
        });
    }
    /**
     * Fetch latest evidence articles from RSS feed
     */
    async fetchLatestEvidenceArticles() {
        try {
            log('Fetching RSS feed from Kill the Newsletter...');
            const response = await fetch(this.rssUrl);
            if (!response.ok) {
                throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
            }
            const xmlContent = await response.text();
            log(`Fetched RSS content (${xmlContent.length} characters)`);
            const parsedFeed = this.xmlParser.parse(xmlContent);
            if (!parsedFeed.rss?.channel) {
                throw new Error('Invalid RSS format: missing channel');
            }
            const items = parsedFeed.rss.channel.item;
            if (!items) {
                log('No items found in RSS feed');
                return [];
            }
            // Normalize to array (single item feeds return object, not array)
            const itemArray = Array.isArray(items) ? items : [items];
            log(`Found ${itemArray.length} items in RSS feed`);
            const articles = [];
            for (const item of itemArray) {
                try {
                    const article = await this.parseRSSItem(item);
                    if (article) {
                        articles.push(article);
                    }
                }
                catch (error) {
                    log(`Error parsing RSS item: ${error.message}`, 'warn');
                    continue;
                }
            }
            log(`Successfully parsed ${articles.length} articles from RSS feed`);
            return articles;
        }
        catch (error) {
            log(`RSS fetching failed: ${error.message}`, 'error');
            throw error;
        }
    }
    /**
     * Parse a single RSS item into EmailArticleData format
     */
    async parseRSSItem(item) {
        if (!item.description) {
            log('RSS item missing description content', 'warn');
            return null;
        }
        // Parse the HTML content from the RSS description (email content)
        const articles = this.extractArticlesFromHtmlContent(item.description);
        // For now, return the first article found in the item
        // RSS items from Kill the Newsletter contain the full email content
        return articles.length > 0 ? articles[0] : null;
    }
    /**
     * Extract articles from HTML content using shared email parser logic
     */
    extractArticlesFromHtmlContent(htmlContent) {
        return extractArticlesFromHtml(htmlContent);
    }
    /**
     * Test RSS feed connection
     */
    async testConnection() {
        try {
            log('Testing RSS feed connection...');
            const response = await fetch(this.rssUrl, { method: 'HEAD' });
            const isValid = response.ok && response.headers.get('content-type')?.includes('xml');
            if (isValid) {
                log('✅ RSS feed connection test successful');
            }
            else {
                log(`❌ RSS feed connection test failed: ${response.status} ${response.statusText}`, 'error');
            }
            return isValid;
        }
        catch (error) {
            log(`❌ RSS feed connection test failed: ${error.message}`, 'error');
            return false;
        }
    }
    /**
     * Get RSS feed metadata
     */
    async getFeedInfo() {
        try {
            const response = await fetch(this.rssUrl);
            if (!response.ok) {
                throw new Error(`RSS fetch failed: ${response.status}`);
            }
            const xmlContent = await response.text();
            const parsedFeed = this.xmlParser.parse(xmlContent);
            const channel = parsedFeed.rss?.channel;
            const items = channel?.item;
            const itemCount = Array.isArray(items) ? items.length : (items ? 1 : 0);
            return {
                title: channel?.title,
                description: channel?.description,
                itemCount
            };
        }
        catch (error) {
            log(`Error getting feed info: ${error.message}`, 'error');
            return { itemCount: 0 };
        }
    }
}
