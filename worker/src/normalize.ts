import { NewsItem } from './types';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
  'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how', 'been',
  'being', 'their', 'then', 'there', 'these', 'those', 'than', 'them'
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractShingles(text: string, k: number = 3): Set<string> {
  const normalized = normalizeText(text);
  const shingles = new Set<string>();
  
  for (let i = 0; i <= normalized.length - k; i++) {
    shingles.add(normalized.substring(i, i + k));
  }
  
  return shingles;
}

export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function extractCanonicalUrl(html: string): string | undefined {
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch) return canonicalMatch[1];
  
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrlMatch) return ogUrlMatch[1];
  
  return undefined;
}

export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking parameters
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'src'].forEach(param => {
      parsed.searchParams.delete(param);
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isSameArticle(item1: NewsItem, item2: NewsItem): boolean {
  // Check if canonical URLs match
  if (item1.canonical_url && item2.canonical_url) {
    return item1.canonical_url === item2.canonical_url;
  }
  
  // Check if cleaned URLs match
  const url1 = cleanUrl(item1.url);
  const url2 = cleanUrl(item2.url);
  
  if (url1 === url2) return true;
  
  // Check if domain and path match (ignoring query params)
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    
    return parsed1.hostname === parsed2.hostname && 
           parsed1.pathname === parsed2.pathname;
  } catch {
    return false;
  }
}

export function generateNeutralHeadline(title: string, content?: string): string {
  // Remove clickbait patterns
  let neutral = title
    .replace(/you won't believe/gi, '')
    .replace(/shocking/gi, '')
    .replace(/brutal/gi, '')
    .replace(/destroyed/gi, '')
    .replace(/slammed/gi, 'criticized')
    .replace(/blasted/gi, 'criticized')
    .replace(/\?$/g, '')
    .replace(/!+/g, '.')
    .replace(/^breaking:\s*/gi, '')
    .replace(/^exclusive:\s*/gi, '')
    .replace(/^just in:\s*/gi, '');
    
  // Remove excessive adjectives
  neutral = neutral
    .replace(/\b(amazing|incredible|unbelievable|insane|crazy|wild)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Ensure it's not too long
  if (neutral.length > 85) {
    const words = neutral.split(' ');
    neutral = words.slice(0, Math.floor(words.length * 0.7)).join(' ');
    if (!neutral.endsWith('.')) neutral += '...';
  }
  
  // Capitalize first letter
  neutral = neutral.charAt(0).toUpperCase() + neutral.slice(1);
  
  return neutral;
}

export function generateClusterHeadline(items: NewsItem[]): string {
  if (items.length === 1) {
    return generateNeutralHeadline(items[0].title, items[0].content);
  }

  // Extract key entities and topics from all articles
  const allText = items.map(item => `${item.title} ${item.standfirst || ''}`).join(' ');
  
  // Find most common meaningful words (excluding stopwords)
  const words = allText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !STOPWORDS.has(word));
  
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  });

  // Get top entities mentioned across sources
  const topWords = Array.from(wordCounts.entries())
    .filter(([word, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Try to extract key action/event
  const actionWords = ['says', 'announces', 'reports', 'confirms', 'denies', 'plans', 'agrees', 'rejects', 'calls', 'warns'];
  const actions = items.flatMap(item => 
    actionWords.filter(action => item.title.toLowerCase().includes(action))
  );

  // Build synthesized headline
  if (topWords.length > 0) {
    const mainEntity = topWords[0].charAt(0).toUpperCase() + topWords[0].slice(1);
    const action = actions.length > 0 ? actions[0] : 'in focus as';
    
    // Try to capture the essence from multiple headlines
    let synthesized = `${mainEntity} ${action} multiple sources report developments`;
    
    // If we can extract a common theme, use it
    const themes = ['deal', 'agreement', 'meeting', 'summit', 'talks', 'war', 'conflict', 'economy', 'market'];
    const detectedTheme = themes.find(theme => 
      items.some(item => item.title.toLowerCase().includes(theme))
    );
    
    if (detectedTheme) {
      synthesized = `${mainEntity} ${action} ${detectedTheme}`;
    }
    
    return synthesized.length > 85 ? synthesized.substring(0, 82) + '...' : synthesized;
  }

  // Fallback: use the most recent title but clean it
  return generateNeutralHeadline(items[0].title, items[0].content);
}

export function generateBulletSummary(items: NewsItem[]): string[] {
  if (items.length === 0) return [];

  const bullets: string[] = [];
  const processedFacts = new Set<string>();

  // Extract key facts from each article
  items.forEach(item => {
    const text = item.standfirst || item.content || '';
    if (!text || text.length < 50) return;

    // Split into sentences and find informative ones
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);

    sentences.forEach(sentence => {
      // Skip if we've seen a similar fact
      const normalizedSentence = normalizeText(sentence);
      if (processedFacts.has(normalizedSentence)) return;

      // Look for factual statements (contain numbers, names, specific actions)
      const hasNumbers = /\d+/.test(sentence);
      const hasProperNouns = /[A-Z][a-z]+/.test(sentence);
      const hasActionWords = /(said|announced|reported|confirmed|stated|revealed|showed|found)/i.test(sentence);

      if ((hasNumbers || hasProperNouns) && hasActionWords) {
        // Clean up the sentence
        let cleanSentence = sentence
          .replace(/^(according to|sources say|reports suggest|it is reported)/i, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanSentence.length > 15) {
          bullets.push(cleanSentence);
          processedFacts.add(normalizedSentence);
        }
      }
    });
  });

  // If we don't have enough bullets, add source attribution
  if (bullets.length < 2) {
    const sources = [...new Set(items.map(item => item.source))];
    bullets.push(`Reported by ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? ' and others' : ''}`);
  }

  // Limit to 4 key points
  return bullets.slice(0, 4);
}

// New AI-powered summary generation
export async function generateAISummary(items: NewsItem[], env?: any): Promise<string> {
  if (items.length === 0) return '';

  // Combine content from all articles in the cluster (further reduced for CPU efficiency)
  const combinedContent = items.map(item => {
    const title = item.title || '';
    const content = item.standfirst || item.content || '';
    const source = item.source || '';
    return `[${source}] ${title}: ${content}`;
  }).join('\n\n').slice(0, 2000); // Further reduced to 2000 chars for faster processing

  const prompt = `Summarize this news into 5 bullet points. Be factual and concise.

${combinedContent}

Output exactly 5 bullets starting with "-":`;

  try {
    // Use Cloudflare AI with gpt-oss-120b (OpenAI-compatible format)
    if (env?.AI) {
      const response = await env.AI.run('@cf/openai/gpt-oss-120b', {
        instructions: 'Create exactly 5 bullet point summaries. Be concise.',
        input: prompt,
        max_tokens: 150
      });
      
      const summary = response.response?.trim() || '';
      
      // Post-process to extract and clean bullets
      const cleanSummary = cleanAIBullets(summary);
      if (cleanSummary) {
        return cleanSummary;
      }
      
      // If AI bullets failed, try to use AI response as-is if it's reasonable
      if (summary && summary.length > 20 && summary.length < 500) {
        // Clean up any remaining formatting issues
        const cleanedResponse = summary
          .replace(/^(Here (is|are).*?:|Summary:|The summary is:)/gi, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .trim();
        return cleanedResponse;
      }
      
      // Final fallback to structured bullets
      return generateFallbackBullets(items);
    }
    
    // Fallback to simple extraction if AI is not available
    return generateFallbackBullets(items);
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return generateFallbackBullets(items);
  }
}

// Clean and extract bullets from AI response
function cleanAIBullets(aiResponse: string): string {
  // Find first bullet point in the response
  const bulletStartIndex = aiResponse.search(/^[-•*]/m);
  const cleanText = bulletStartIndex > -1 ? aiResponse.slice(bulletStartIndex).trim() : aiResponse;
  
  // Extract bullet points
  const bullets = cleanText
    .split(/\n/)
    .map(line => line.trim())
    .filter(line => /^[-•*]\s*/.test(line))
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length > 0)
    .slice(0, 5); // Take only first 5 bullets

  // If we have 3-5 bullets, return them (be more lenient)
  if (bullets.length >= 3) {
    return bullets.map(bullet => `• ${bullet}`).join('\n');
  }
  
  // If we don't have enough bullets, return empty to trigger fallback
  return '';
}

// Fallback bullet generation for when AI fails
function generateFallbackBullets(items: NewsItem[]): string {
  if (items.length === 0) return '• No summary available.';
  
  const bullets: string[] = [];
  const sources = [...new Set(items.map(item => item.source))];
  const mainItem = items[0];
  
  // Bullet 1: What happened (clean headline)
  const cleanTitle = mainItem.title
    .replace(/^(Breaking:|Live:|Update:|Exclusive:)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  bullets.push(`${cleanTitle}${cleanTitle.endsWith('.') ? '' : '.'}`);
  
  // Bullet 2: Key details from content
  const keyContent = items
    .map(item => item.standfirst || item.content || '')
    .filter(content => content.length > 50)
    .slice(0, 2)
    .join(' ');
    
  if (keyContent) {
    const sentences = keyContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      let detail = sentences[0].trim();
      if (detail.length > 120) {
        detail = detail.substring(0, 117) + '...';
      }
      bullets.push(`${detail}${detail.endsWith('.') ? '' : '.'}`);
    } else {
      bullets.push('Details are emerging about the reported developments.');
    }
  } else {
    bullets.push('Additional details are being reported by news outlets.');
  }
  
  // Bullet 3: Sources/attribution 
  if (sources.length >= 3) {
    bullets.push(`Multiple outlets including ${sources.slice(0, 2).join(', ')} and others are covering the story.`);
  } else if (sources.length === 2) {
    bullets.push(`${sources[0]} and ${sources[1]} are among sources reporting this story.`);
  } else {
    bullets.push(`${sources[0]} is reporting on this developing story.`);
  }
  
  // Bullet 4: Context/stakes - try to be more specific
  const contextKeywords = ['government', 'election', 'economy', 'climate', 'war', 'peace', 'trade', 'security', 'health'];
  const titleLower = mainItem.title.toLowerCase();
  let context = 'The development comes amid ongoing tensions and broader considerations.';
  
  if (contextKeywords.some(keyword => titleLower.includes(keyword))) {
    if (titleLower.includes('election') || titleLower.includes('government')) {
      context = 'The announcement has political implications and could affect governance decisions.';
    } else if (titleLower.includes('economy') || titleLower.includes('trade')) {
      context = 'The development may have economic consequences and market implications.';
    } else if (titleLower.includes('war') || titleLower.includes('peace') || titleLower.includes('security')) {
      context = 'The situation is being closely watched for security and diplomatic implications.';
    }
  }
  bullets.push(context);
  
  // Bullet 5: What's next
  bullets.push('Further developments and official responses are anticipated.');
  
  return bullets.slice(0, 5).map(bullet => `• ${bullet}`).join('\n');
}

// Fallback function for simple summary generation
function generateSimpleSummary(items: NewsItem[]): string {
  if (items.length === 0) return '';
  
  // Use the longest standfirst/content as base
  const bestItem = items.reduce((best, current) => {
    const bestContent = (best.standfirst || best.content || '').length;
    const currentContent = (current.standfirst || current.content || '').length;
    return currentContent > bestContent ? current : best;
  });
  
  const content = bestItem.standfirst || bestItem.content || '';
  // Return first 2-3 sentences, cleaned up
  const sentences = content.split(/[.!?]+/).slice(0, 3);
  return sentences.join('. ').trim() + (sentences.length > 0 ? '.' : '');
}

// AI-powered headline generation
export async function generateAIHeadline(items: NewsItem[], env?: any): Promise<string> {
  if (items.length === 0) return '';

  // Combine titles from all articles in the cluster
  const titles = items.map(item => item.title).join(' | ');
  const content = items.map(item => item.standfirst || '').join(' ').slice(0, 1000);

  const prompt = `Write exactly one clear news headline for this story. Do not include quotes, bullet points, or multiple options.

Headlines from different sources: ${titles}

Context: ${content}

Headline:`;

  try {
    // Use Cloudflare AI with gpt-oss-120b
    if (env?.AI) {
      const response = await env.AI.run('@cf/openai/gpt-oss-120b', {
        instructions: 'You are a professional news editor. Create clear, neutral headlines.',
        input: prompt,
        max_tokens: 50
      });
      
      const headline = response.response?.trim() || '';
      // Clean up any quotes, bullet points, multiple options, or extra formatting
      const cleanHeadline = headline
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^(Headline:|Here are.*?:|Option.*?:|\*.*?\*)/gi, '') // Remove prefixes
        .split(/\n|\*|\-|•/)[0] // Take only first line/option
        .replace(/^\s*[\-\*•]\s*/, '') // Remove bullet points
        .trim();
      return cleanHeadline || selectBestHeadline(items);
    }
    
    // Fallback to existing logic
    return selectBestHeadline(items);
  } catch (error) {
    console.error('AI headline generation failed:', error);
    return selectBestHeadline(items);
  }
}

export function selectBestHeadline(items: NewsItem[]): string {
  if (items.length === 1) {
    return generateNeutralHeadline(items[0].title);
  }

  // Score headlines based on quality factors
  const scoredHeadlines = items.map(item => {
    const title = item.title;
    let score = 0;

    // Prefer shorter, more direct headlines (but not too short)
    if (title.length >= 20 && title.length <= 80) score += 3;
    else if (title.length <= 100) score += 1;

    // Prefer headlines that don't start with editorial markers
    if (!title.match(/^(The Papers?:|Breaking:|Exclusive:|Just In:|Live:|Update:)/i)) score += 2;

    // Prefer headlines that don't have lots of punctuation
    const punctuationCount = (title.match(/[!?:;]/g) || []).length;
    if (punctuationCount <= 1) score += 2;

    // Prefer headlines from certain sources (more neutral/authoritative)
    if (['Guardian World', 'BBC World', 'Al Jazeera'].includes(item.source)) score += 1;

    // Avoid headlines with too many quotes or parentheses
    const quotesCount = (title.match(/['"]/g) || []).length;
    if (quotesCount <= 2) score += 1;

    return { title, score, source: item.source };
  });

  // Sort by score (highest first), then by recency
  scoredHeadlines.sort((a, b) => b.score - a.score);

  // Return the best headline, cleaned up
  const bestTitle = scoredHeadlines[0].title;
  return generateNeutralHeadline(bestTitle);
}