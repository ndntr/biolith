import { XMLParser } from 'fast-xml-parser';
import { decode } from 'html-entities';
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
      trimValues: false,  // Don't trim to preserve content
      parseTagValue: false, // Don't parse content as values to prevent truncation
      processEntities: true, // Process XML entities
      htmlEntities: true // Handle HTML entities
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
    log('Parsing RSS item...');
    log(`Item keys: ${Object.keys(item).join(', ')}`);
    
    let content = '';
    let contentSource = 'none';
    
    // Enhanced content extraction for different feed formats
    if (item.content) {
      if (typeof item.content === 'string') {
        content = item.content;
        contentSource = 'content-string';
      } else if (typeof item.content === 'object') {
        // Handle Atom <content type="html"> structure
        if (item.content.value) {
          content = item.content.value;
          contentSource = 'content-value';
        } else if (item.content['#text']) {
          content = item.content['#text'];
          contentSource = 'content-#text';
        } else if (item.content._) {
          content = item.content._;
          contentSource = 'content-_';
        } else {
          // Content object might contain the data directly
          content = String(item.content);
          contentSource = 'content-stringified';
        }
      }
    }
    
    // Fallback to description or summary
    if (!content && item.description) {
      content = typeof item.description === 'string' ? item.description : String(item.description);
      contentSource = 'description';
    }
    
    if (!content && item.summary) {
      content = typeof item.summary === 'string' ? item.summary : String(item.summary);
      contentSource = 'summary';
    }
    
    // Log content extraction details
    log(`Content extracted from: ${contentSource}`);
    log(`Raw content length: ${content.length} characters`);
    
    if (content.length < 100) {
      log(`Short content detected: "${content}"`);
    }
    
    if (!content) {
      log('RSS/Atom item missing content/description', 'error');
      return [];
    }
    
    // Validate content length (should be substantial for EvidenceAlerts email)
    if (content.length < 1000) {
      log(`Warning: Content unusually short (${content.length} chars) - may indicate parsing issue`, 'warn');
    }
    
    // Decode HTML entities
    let decodedContent;
    try {
      decodedContent = decode(content);
      log(`HTML entity decoding: ${content.length} -> ${decodedContent.length} characters`);
    } catch (error) {
      log(`HTML entity decoding failed: ${error.message}`, 'warn');
      decodedContent = content; // Use original if decoding fails
    }

    // Parse the HTML content from the RSS item (email content)
    // Each RSS item from Kill the Newsletter contains the full email content
    // which may have multiple EvidenceAlerts articles
    const articles = this.extractArticlesFromHtmlContent(decodedContent);
    
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