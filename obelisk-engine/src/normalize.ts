import { NewsItem } from './types';
import { geminiQueue } from './request-queue';
import { geminiQuotaTracker } from './quota-tracker';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_API_VERSION = 'v1';
type GeminiApiError = Error & { status?: number; retryAfter?: number };

function getGeminiEndpoint(apiKey: string, env?: any): string {
  const geminiModel = env?.GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const geminiApiVersion = env?.GEMINI_API_VERSION || process.env.GEMINI_API_VERSION || DEFAULT_GEMINI_API_VERSION;
  return `https://generativelanguage.googleapis.com/${geminiApiVersion}/models/${geminiModel}:generateContent?key=${apiKey}`;
}

function createGeminiApiError(status: number): GeminiApiError {
  const modelHint = status === 404 || status === 410
    ? ' Model not found or deprecated; update GEMINI_MODEL to a supported model.'
    : '';
  const error = new Error(`Gemini API error: ${status}.${modelHint}`) as GeminiApiError;
  error.status = status;
  return error;
}

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

// Batch process multiple clusters with Gemini API in smaller chunks
export async function generateBatchAISummaries(clusters: any[], env?: any): Promise<void> {
  if (clusters.length === 0) return;

  const geminiApiKey = process.env.GEMINI_API_KEY || env?.GEMINI_API_KEY;
  if (!geminiApiKey) return;

  // Process in chunks optimized for Gemini 2.5 Flash free tier (15 RPM, 200 RPD)
  const CHUNK_SIZE = 15;
  const MAX_CONCURRENT = 1; // Reduced from 3 to prevent bursts exceeding 15 RPM
  
  console.log(`Processing ${clusters.length} clusters in chunks of ${CHUNK_SIZE} with ${MAX_CONCURRENT} concurrent requests`);
  
  // Split clusters into chunks
  let chunks: any[][] = [];
  for (let i = 0; i < clusters.length; i += CHUNK_SIZE) {
    chunks.push(clusters.slice(i, i + CHUNK_SIZE));
  }
  
  // Check quota before processing
  const quotaStatus = await geminiQuotaTracker.getStatus();
  console.log(`Quota status: ${quotaStatus.used}/${quotaStatus.total} requests used today, ${quotaStatus.remaining} remaining`);
  
  if (quotaStatus.remaining < chunks.length) {
    console.warn(`⚠️ Daily quota insufficient: need ${chunks.length} requests, have ${quotaStatus.remaining} remaining`);
    console.warn(`Quota resets at ${quotaStatus.resetsAt}`);
    // Process only what we can
    chunks = chunks.slice(0, Math.max(0, quotaStatus.remaining));
    if (chunks.length === 0) {
      console.log('Skipping AI processing - daily quota exhausted');
      return;
    }
  }
  
  // Process chunks with controlled parallelism
  const processChunk = async (chunk: any[], chunkIndex: number) => {
    // Prepare batch input for this chunk
    const batchInput = chunk.map((cluster, index) => {
      const combinedContent = cluster.items.map(item => {
        const title = item.title || '';
        const content = item.standfirst || item.content || '';
        const source = item.source || '';
        return `[${source}] ${title}: ${content}`;
      }).join('\n\n').slice(0, 2000); // Limit per cluster

      return `\n## CLUSTER ${index + 1}:\n${combinedContent}`;
    }).join('\n');

    const prompt = `Process ${chunk.length} news clusters. For each cluster, generate:
1. A neutral headline (max 12 words, no period, no contractions)
2. A 5-bullet summary (max 26 words per bullet)

SPECIAL CASE: For clusters containing newsGP articles, preserve the original headline exactly and generate ONLY the summary.

Format your response as:
CLUSTER 1:
HEADLINE: [headline here]
SUMMARY:
- [bullet 1]
- [bullet 2]
- [bullet 3]
- [bullet 4]
- [bullet 5]

CLUSTER 2:
[repeat format]

Requirements:
- Headlines: factual, no clickbait, no "Here's what..." endings (EXCEPT for newsGP - preserve exactly)
- Summaries: specific facts only, no speculation, no generic statements
- Use full words not contractions (government not govt)
- For newsGP clusters: use original headline verbatim, focus on generating quality summary bullets

${batchInput}`;

    try {
      const response = await geminiQueue.enqueue(async () => {
        const res = await fetch(getGeminiEndpoint(geminiApiKey, env), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              maxOutputTokens: 3000, // Increased to allow complete 15-cluster processing
              temperature: 0.1
            }
          })
        });
        
        if (!res.ok) {
          const error = createGeminiApiError(res.status);
          error.retryAfter = res.headers.get('retry-after') ? 
            parseInt(res.headers.get('retry-after')!) : undefined;
          throw error;
        }
        
        return res;
      }, 10 - (chunkIndex % 3)); // Vary priority slightly to avoid thundering herd
      
      const result = await response.json() as any;
      const batchResponse = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Parse the batch response and assign to this chunk
      parseBatchResponse(batchResponse, chunk);
      
      // Track successful request
      await geminiQuotaTracker.incrementRequests(1);
      
      console.log(`Chunk ${chunkIndex + 1}/${chunks.length} processed successfully`);
      
    } catch (error) {
      console.error(`Chunk ${chunkIndex + 1}/${chunks.length} AI processing failed:`, error);
      // This chunk will keep original titles and no AI summaries
    }
  };
  
  // Process chunks in batches with controlled concurrency
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT);
    const promises = batch.map((chunk, index) => processChunk(chunk, i + index));
    
    // Wait for this batch to complete before starting the next
    await Promise.allSettled(promises);
    
    // Small delay between batches to avoid bursting
    if (i + MAX_CONCURRENT < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between batches
    }
  }
  
  console.log('All chunks processed');
}

function parseBatchResponse(response: string, clusters: any[]): void {
  const clusterBlocks = response.split(/CLUSTER \d+:/i).slice(1);
  
  for (let i = 0; i < Math.min(clusterBlocks.length, clusters.length); i++) {
    const block = clusterBlocks[i];
    const cluster = clusters[i];
    
    // Check if this cluster contains newsGP articles
    const isNewsGPCluster = cluster.items?.some((item: any) => item.source === 'newsGP');
    
    // Extract headline (skip for newsGP clusters)
    const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|SUMMARY:|$)/i);
    if (headlineMatch && !isNewsGPCluster) {
      let headline = headlineMatch[1].trim();
      // Clean up the headline
      headline = headline
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/\.+$/, '') // Remove trailing periods
        .trim();
      if (headline) {
        clusters[i].neutral_headline = headline;
      }
    }
    
    // Extract summary bullets
    const summaryMatch = block.match(/SUMMARY:\s*((?:\s*-.*(?:\n|$))+)/i);
    if (summaryMatch) {
      const bullets = summaryMatch[1]
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 5); // Max 5 bullets
      
      if (bullets.length >= 3) { // Only use if we got at least 3 good bullets
        // Store as array for frontend compatibility
        clusters[i].ai_summary = bullets;
      }
    }
  }
}

// New AI-powered summary generation using Gemini API (kept for backward compatibility)
export async function generateAISummary(items: NewsItem[], env?: any): Promise<string> {
  if (items.length === 0) return '';

  // Combine content from all articles in the cluster
  const combinedContent = items.map(item => {
    const title = item.title || '';
    const content = item.standfirst || item.content || '';
    const source = item.source || '';
    return `[${source}] ${title}: ${content}`;
  }).join('\n\n').slice(0, 3000); // More content allowed with Gemini

  const prompt = `For the article(s) provided, summarize the news story into a 5-bullet point overview. Summarize only what is supported by the supplied articles. Be concise, neutral, and specific. Avoid clickbait, vagueness, adjectives, and opinion.

Requirements:
- Output EXACTLY 5 bullets. Each one should be ≤ 26 words.
- Lead with what/where/when. Include proper nouns and titles once; then use surnames/roles.
- Prefer facts corroborated by ≥2 distinct sources; if reports conflict, state the disagreement.
- Include concrete numbers/quotes only when clearly sourced.
- One bullet should give immediate context or stakes; the last bullet should be "what's next" or next scheduled step.
- No speculation. No rhetorical questions. No outlet names. No timestamps/citations in bullets.
- Use present tense and clear attributions ("The White House says…", "European and Ukrainian leaders urge…").
- Start each bullet with a hyphen (-) on a new line.

Articles:
${combinedContent}

Output exactly 5 bullets:`;

  try {
    // Use Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY || env?.GEMINI_API_KEY;
    
    if (geminiApiKey) {
      const response = await geminiQueue.enqueue(async () => {
        const res = await fetch(getGeminiEndpoint(geminiApiKey, env), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              maxOutputTokens: 200,
              temperature: 0.1
            }
          })
        });
        
        if (!res.ok) {
          const error = createGeminiApiError(res.status);
          error.retryAfter = res.headers.get('retry-after') ? 
            parseInt(res.headers.get('retry-after')!) : undefined;
          throw error;
        }
        
        return res;
      }, 5); // Medium priority for individual summaries
      
      const result = await response.json() as any;
      const summary = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
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

// Fallback bullet generation for when AI fails - return empty rather than generic content
function generateFallbackBullets(items: NewsItem[]): string {
  // Return empty string - better to have no summary than generic filler
  return '';
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

  const prompt = `Write exactly one clear, factual news headline for this story.

Requirements:
- Write ONE single sentence only
- State facts, not questions or teasers
- Do not use contractions (use "government" not "govt", "will not" not "won't")
- Do not add commentary like "Here's what it means" or "What you need to know"
- Do not use clickbait phrases or rhetorical questions
- Keep it under 12 words if possible
- Be specific and direct

Headlines from different sources: ${titles}

Context: ${content}

Headline:`;

  try {
    // Use Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY || env?.GEMINI_API_KEY;
    
    if (geminiApiKey) {
      const response = await geminiQueue.enqueue(async () => {
        const res = await fetch(getGeminiEndpoint(geminiApiKey, env), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              maxOutputTokens: 50,
              temperature: 0.1
            }
          })
        });
        
        if (!res.ok) {
          const error = createGeminiApiError(res.status);
          error.retryAfter = res.headers.get('retry-after') ? 
            parseInt(res.headers.get('retry-after')!) : undefined;
          throw error;
        }
        
        return res;
      }, 5); // Medium priority for headlines
      
      const result = await response.json() as any;
      const headline = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      // Clean up any quotes, bullet points, multiple options, or extra formatting
      let cleanHeadline = headline
        .replace(/^["']|["']$/g, '') // Remove quotes
        .replace(/^(Headline:|Here are.*?:|Option.*?:|\*.*?\*)/gi, '') // Remove prefixes
        .split(/\n|\*|\-|•/)[0] // Take only first line/option
        .replace(/^\s*[\-\*•]\s*/, '') // Remove bullet points
        .trim();
      
      // Remove any "Here's what..." or similar clickbait endings
      cleanHeadline = cleanHeadline
        .replace(/\.\s*(Here's what.*|What you need to know.*|What it means.*)$/i, '')
        .trim();
      
      // Expand common contractions that might slip through
      cleanHeadline = cleanHeadline
        .replace(/\bgovt\b/gi, 'government')
        .replace(/\bdon't\b/gi, 'do not')
        .replace(/\bwon't\b/gi, 'will not')
        .replace(/\bcan't\b/gi, 'cannot')
        .replace(/\bisn't\b/gi, 'is not')
        .replace(/\baren't\b/gi, 'are not')
        .replace(/\bwasn't\b/gi, 'was not')
        .replace(/\bweren't\b/gi, 'were not')
        .replace(/\bit's\b/gi, 'it is')
        .replace(/\bthat's\b/gi, 'that is')
        .replace(/\bhere's\b/gi, 'here is')
        .replace(/\bthere's\b/gi, 'there is')
        .replace(/\bwhat's\b/gi, 'what is');
      
      // Remove trailing periods from headlines (news headlines shouldn't end with periods)
      cleanHeadline = cleanHeadline.replace(/\.+$/, '').trim();
      
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
