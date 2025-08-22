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

      const parsedFeed = this.xmlParser.parse(xmlContent) as any;
      
      // Handle different RSS formats more flexibly
      let channel;
      let items;
      
      if (parsedFeed.rss?.channel) {
        // Standard RSS 2.0 format
        channel = parsedFeed.rss.channel;
        items = channel.item;
      } else if (parsedFeed.channel) {
        // Direct channel format (some non-standard feeds)
        channel = parsedFeed.channel;
        items = channel.item;
      } else if (parsedFeed.feed?.entry) {
        // Atom format
        channel = parsedFeed.feed;
        items = channel.entry;
      } else if (parsedFeed.rss) {
        // RSS without proper channel structure
        const rssContent = parsedFeed.rss;
        if (rssContent.item) {
          items = rssContent.item;
        } else {
          // Log the structure for debugging
          log(`Unexpected RSS structure. Root keys: ${Object.keys(parsedFeed).join(', ')}`, 'warn');
          if (parsedFeed.rss) {
            log(`RSS keys: ${Object.keys(parsedFeed.rss).join(', ')}`, 'warn');
          }
          throw new Error(`Invalid RSS format: unexpected structure. Root keys: ${Object.keys(parsedFeed).join(', ')}`);
        }
      } else {
        // Log the structure for debugging
        log(`Unknown feed format. Root keys: ${Object.keys(parsedFeed).join(', ')}`, 'warn');
        throw new Error(`Invalid RSS format: unsupported structure. Root keys: ${Object.keys(parsedFeed).join(', ')}`);
      }
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
          const itemArticles = await this.parseRSSItem(item);
          if (itemArticles && itemArticles.length > 0) {
            articles.push(...itemArticles);
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
   * Parse a single RSS/Atom item into EmailArticleData format
   * Returns all articles found in the RSS item
   */
  private async parseRSSItem(item: any): Promise<EmailArticleData[]> {
    // Handle both RSS and Atom formats
    let content = item.description || item.content || item.summary;
    
    // For Atom feeds, content might be in a different structure
    if (!content && item.content) {
      content = typeof item.content === 'string' ? item.content : item.content['#text'] || item.content.value;
    }
    
    if (!content) {
      log('RSS/Atom item missing content/description', 'warn');
      log(`Item keys: ${Object.keys(item).join(', ')}`, 'warn');
      return [];
    }

    // Parse the HTML content from the RSS description (email content)
    // Each RSS item from Kill the Newsletter contains the full email content
    // which may have multiple EvidenceAlerts articles
    const articles = this.extractArticlesFromHtmlContent(content);
    
    log(`Found ${articles.length} articles in RSS item`);
    return articles;
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