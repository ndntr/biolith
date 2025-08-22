import { XMLParser } from 'fast-xml-parser';
import { EmailArticleData } from './types.js';
import { log } from './utils.js';
import { extractArticlesFromHtml } from './email-parser.js';

interface RSSItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  guid?: string;
}

interface RSSFeed {
  rss?: {
    channel?: {
      title?: string;
      description?: string;
      item?: RSSItem | RSSItem[];
    };
  };
}

/**
 * Fetch and parse RSS feed from Kill the Newsletter
 */
export class RSSFetcher {
  private rssUrl: string;
  private xmlParser: XMLParser;

  constructor(rssUrl: string) {
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
  async fetchLatestEvidenceArticles(): Promise<EmailArticleData[]> {
    try {
      log('Fetching RSS feed from Kill the Newsletter...');
      
      const response = await fetch(this.rssUrl);
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
      }

      const xmlContent = await response.text();
      log(`Fetched RSS content (${xmlContent.length} characters)`);

      const parsedFeed = this.xmlParser.parse(xmlContent) as RSSFeed;
      
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

      const articles: EmailArticleData[] = [];
      
      for (const item of itemArray) {
        try {
          const article = await this.parseRSSItem(item);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          log(`Error parsing RSS item: ${error.message}`, 'warn');
          continue;
        }
      }

      log(`Successfully parsed ${articles.length} articles from RSS feed`);
      return articles;

    } catch (error) {
      log(`RSS fetching failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Parse a single RSS item into EmailArticleData format
   */
  private async parseRSSItem(item: RSSItem): Promise<EmailArticleData | null> {
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
  private extractArticlesFromHtmlContent(htmlContent: string): EmailArticleData[] {
    return extractArticlesFromHtml(htmlContent);
  }

  /**
   * Test RSS feed connection
   */
  async testConnection(): Promise<boolean> {
    try {
      log('Testing RSS feed connection...');
      const response = await fetch(this.rssUrl, { method: 'HEAD' });
      const isValid = response.ok && response.headers.get('content-type')?.includes('xml');
      
      if (isValid) {
        log('✅ RSS feed connection test successful');
      } else {
        log(`❌ RSS feed connection test failed: ${response.status} ${response.statusText}`, 'error');
      }
      
      return isValid;
    } catch (error) {
      log(`❌ RSS feed connection test failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Get RSS feed metadata
   */
  async getFeedInfo(): Promise<{title?: string, description?: string, itemCount: number}> {
    try {
      const response = await fetch(this.rssUrl);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }

      const xmlContent = await response.text();
      const parsedFeed = this.xmlParser.parse(xmlContent) as RSSFeed;
      
      const channel = parsedFeed.rss?.channel;
      const items = channel?.item;
      const itemCount = Array.isArray(items) ? items.length : (items ? 1 : 0);

      return {
        title: channel?.title,
        description: channel?.description,
        itemCount
      };
    } catch (error) {
      log(`Error getting feed info: ${error.message}`, 'error');
      return { itemCount: 0 };
    }
  }
}