import { XMLParser } from 'fast-xml-parser';
import { NewsItem, FeedSource } from './types';
import { cleanUrl, extractCanonicalUrl } from './normalize';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text'
});

export async function fetchRSSFeed(source: FeedSource): Promise<NewsItem[]> {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ActuaNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${source.name}: ${response.status}`);
      return [];
    }
    
    const text = await response.text();
    const parsed = parser.parse(text);
    
    const items: NewsItem[] = [];
    
    // Handle RSS 2.0 format
    if (parsed.rss?.channel?.item) {
      const feedItems = Array.isArray(parsed.rss.channel.item) 
        ? parsed.rss.channel.item 
        : [parsed.rss.channel.item];
        
      for (let i = 0; i < feedItems.length; i++) {
        const item = feedItems[i];
        items.push({
          source: source.name,
          url: cleanUrl(item.link || item.guid || ''),
          published_at: item.pubDate || new Date().toISOString(),
          title: cleanText(item.title),
          standfirst: cleanText(item.description || item.summary || ''),
          content: cleanText(item['content:encoded'] || item.description || ''),
          feed_position: i // Track position in RSS feed for popularity scoring
        });
      }
    }
    
    // Handle Atom format
    if (parsed.feed?.entry) {
      const feedItems = Array.isArray(parsed.feed.entry) 
        ? parsed.feed.entry 
        : [parsed.feed.entry];
        
      for (let i = 0; i < feedItems.length; i++) {
        const item = feedItems[i];
        const link = item.link?.['@_href'] || item.link || '';
        items.push({
          source: source.name,
          url: cleanUrl(link),
          published_at: item.published || item.updated || new Date().toISOString(),
          title: cleanText(item.title),
          standfirst: cleanText(item.summary || ''),
          content: cleanText(item.content || item.summary || ''),
          feed_position: i // Track position in Atom feed for popularity scoring
        });
      }
    }
    
    // Filter out items from wrong regions
    if (source.section === 'global') {
      // Exclude Australian content from global section
      return items.filter(item => {
        const isAustralian = 
          item.url.includes('.au/') ||
          item.url.includes('australia') ||
          item.title.toLowerCase().includes('australia') ||
          item.title.toLowerCase().includes('aussie');
        return !isAustralian;
      });
    }
    
    if (source.section === 'australia') {
      // Only include Australian content
      return items.filter(item => {
        const isAustralian = 
          item.url.includes('.au/') ||
          item.url.includes('australia') ||
          item.title.toLowerCase().includes('australia') ||
          item.title.toLowerCase().includes('aussie') ||
          source.name.includes('Australia') ||
          source.name.includes('AU');
        return isAustralian;
      });
    }
    
    return items;
    
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error);
    return [];
  }
}

function cleanText(text: any): string {
  if (!text) return '';
  
  // Handle different text structures from XML parser
  let rawText = '';
  
  if (typeof text === 'string') {
    rawText = text;
  } else if (typeof text === 'object') {
    // Extract text from XML parser object structure
    if (text['#text']) {
      rawText = text['#text'];
    } else if (text._ || text.__) {
      rawText = text._ || text.__;
    } else {
      rawText = JSON.stringify(text);
    }
  } else {
    rawText = String(text);
  }
  
  // Remove HTML tags
  let cleaned = rawText.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
    
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

export async function fetchAllFeeds(sources: FeedSource[]): Promise<NewsItem[]> {
  const promises = sources.map(source => fetchRSSFeed(source));
  const results = await Promise.allSettled(promises);
  
  const allItems: NewsItem[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }
  
  // Sort by date (newest first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.published_at).getTime();
    const dateB = new Date(b.published_at).getTime();
    return dateB - dateA;
  });
  
  // Limit to recent items (last 48 hours)
  const cutoffTime = Date.now() - (48 * 60 * 60 * 1000);
  return allItems.filter(item => {
    const itemTime = new Date(item.published_at).getTime();
    return itemTime > cutoffTime;
  });
}

export async function fetchEvidenceAlerts(): Promise<NewsItem[]> {
  try {
    // This would scrape EvidenceAlerts for the month in research section
    // For now, return empty array as this requires more complex scraping
    // In production, you'd implement proper scraping or use their API if available
    return [];
  } catch (error) {
    console.error('Error fetching EvidenceAlerts:', error);
    return [];
  }
}