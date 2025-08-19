import { NewsItem } from './types';

export interface ScrapedArticle {
  title: string;
  url: string;
  published_at: string;
  standfirst?: string;
  popularity_rank: number; // Position in the popular/trending section (0 = most popular)
}

// Scrape ABC News Australia's most read/popular sections
export async function scrapeABCPopularArticles(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://www.abc.net.au/news', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ActuaNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ABC News: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const articles: NewsItem[] = [];
    
    // More sophisticated regex to capture article links with their titles
    // Look for article structures with both href and title/heading
    const articlePattern = /<a[^>]+href="(\/news\/[^"]+)"[^>]*>[\s\S]*?(?:<h[1-6][^>]*>([^<]+)<\/h[1-6]>|<span[^>]*>([^<]+)<\/span>|([^<]+))[\s\S]*?<\/a>/gi;
    
    let match;
    let rank = 0;
    const seenUrls = new Set<string>();
    
    // Reset regex for fresh matching
    articlePattern.lastIndex = 0;
    
    while ((match = articlePattern.exec(html)) !== null && rank < 10) {
      const relativeUrl = match[1];
      const fullUrl = `https://www.abc.net.au${relativeUrl}`;
      
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);
      
      // Extract title from captured groups (h1-h6, span, or plain text)
      const title = (match[2] || match[3] || match[4] || '').trim();
      
      // Skip if we couldn't extract a meaningful title
      if (!title || title.length < 10) continue;
      
      articles.push({
        source: 'ABC News Australia (Popular)',
        url: fullUrl,
        published_at: new Date().toISOString(),
        title: cleanScrapedText(title),
        standfirst: '',
        content: '',
        feed_position: rank // Use rank as feed position for sorting
      });
      
      rank++;
    }
    
    return articles;
  } catch (error) {
    console.error('Error scraping ABC News:', error);
    return [];
  }
}

// Scrape Ars Technica's front page articles (which are typically their most important/popular)
export async function scrapeArsTechnicaPopularArticles(): Promise<NewsItem[]> {
  try {
    const response = await fetch('https://arstechnica.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ActuaNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch Ars Technica: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    const articles: NewsItem[] = [];
    
    // Ars Technica uses structured article links
    // Look for main article links
    const articleRegex = /<article[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/article>/gi;
    
    let match;
    let rank = 0;
    const seenUrls = new Set<string>();
    
    while ((match = articleRegex.exec(html)) !== null && rank < 10) {
      const url = match[1];
      const title = match[2];
      
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      
      // Make sure URL is absolute
      const fullUrl = url.startsWith('http') ? url : `https://arstechnica.com${url}`;
      
      articles.push({
        source: 'Ars Technica',
        url: fullUrl,
        published_at: new Date().toISOString(),
        title: cleanScrapedText(title),
        standfirst: '',
        content: '',
        feed_position: rank // Use rank as feed position for sorting
      });
      
      rank++;
    }
    
    return articles;
  } catch (error) {
    console.error('Error scraping Ars Technica:', error);
    return [];
  }
}

// Clean text extracted from HTML
function cleanScrapedText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Main function to fetch all scraped popular articles
export async function fetchScrapedPopularArticles(): Promise<NewsItem[]> {
  const [abcArticles, arsArticles] = await Promise.allSettled([
    scrapeABCPopularArticles(),
    scrapeArsTechnicaPopularArticles()
  ]);
  
  const allArticles: NewsItem[] = [];
  
  if (abcArticles.status === 'fulfilled') {
    allArticles.push(...abcArticles.value);
  }
  
  if (arsArticles.status === 'fulfilled') {
    allArticles.push(...arsArticles.value);
  }
  
  return allArticles;
}