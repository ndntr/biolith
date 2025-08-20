import { Env, SectionData, MedicalSectionData, NewsCluster } from './types';
import { FEED_SOURCES, getFeedsBySection } from './feeds';
import { fetchAllFeeds, fetchEvidenceAlerts } from './fetcher';
import { clusterNewsItems } from './cluster';
import { fetchScrapedPopularArticles } from './scraper';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers - allow localhost for development
    const origin = request.headers.get('Origin');
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-NEWS-TOKEN',
      'Content-Type': 'application/json'
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Read endpoints
    if (request.method === 'GET') {
      if (path === '/news-api/global') {
        const data = await env.NEWS_KV.get('news:global', 'json');
        return new Response(JSON.stringify(data || { clusters: [], updated_at: new Date().toISOString() }), {
          headers: corsHeaders
        });
      }

      if (path === '/news-api/australia') {
        const data = await env.NEWS_KV.get('news:australia', 'json');
        return new Response(JSON.stringify(data || { clusters: [], updated_at: new Date().toISOString() }), {
          headers: corsHeaders
        });
      }

      if (path === '/news-api/technology') {
        const data = await env.NEWS_KV.get('news:technology', 'json');
        return new Response(JSON.stringify(data || { clusters: [], updated_at: new Date().toISOString() }), {
          headers: corsHeaders
        });
      }

      if (path === '/news-api/medical') {
        const [clinical, professional, patientSignals, monthInResearch] = await Promise.all([
          env.NEWS_KV.get('news:medical:clinical', 'json'),
          env.NEWS_KV.get('news:medical:professional', 'json'),
          env.NEWS_KV.get('news:medical:patient_signals', 'json'),
          env.NEWS_KV.get('news:medical:month_in_research', 'json')
        ]);

        const response: MedicalSectionData = {
          clinical: (clinical as SectionData) || { clusters: [], updated_at: new Date().toISOString() },
          professional: (professional as SectionData) || { clusters: [], updated_at: new Date().toISOString() },
          patient_signals: (patientSignals as SectionData) || { clusters: [], updated_at: new Date().toISOString() },
          month_in_research: (monthInResearch as SectionData) || { clusters: [], updated_at: new Date().toISOString() }
        };

        return new Response(JSON.stringify(response), { headers: corsHeaders });
      }

      if (path === '/news-api/health-today') {
        const data = await env.NEWS_KV.get('news:medical:patient_signals', 'json');
        return new Response(JSON.stringify(data || { clusters: [], updated_at: new Date().toISOString() }), {
          headers: corsHeaders
        });
      }
    }

    // Admin refresh endpoint
    if (request.method === 'POST' && path === '/news-api/admin/refresh') {
      const token = request.headers.get('X-NEWS-TOKEN');
      
      if (token !== env.NEWS_REFRESH_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }

      const section = url.searchParams.get('section');
      const refreshed: string[] = [];

      if (!section || section === 'global') {
        await refreshSection('global', env);
        refreshed.push('global');
      }

      if (!section || section === 'australia') {
        await refreshSection('australia', env);
        refreshed.push('australia');
      }

      if (!section || section === 'technology') {
        await refreshSection('technology', env);
        refreshed.push('technology');
      }

      if (!section || section === 'medical') {
        await refreshMedicalSections(env);
        refreshed.push('medical');
      }

      return new Response(JSON.stringify({
        ok: true,
        refreshed,
        updated_at: new Date().toISOString()
      }), { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Check if current time matches our refresh schedule
    const sydneyTime = new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' });
    const hour = new Date(sydneyTime).getHours();
    
    // Refresh at 4, 10, 16, 20 Sydney time
    if ([4, 10, 16, 20].includes(hour)) {
      await Promise.all([
        refreshSection('global', env),
        refreshSection('australia', env),
        refreshSection('technology', env),
        refreshMedicalSections(env)
      ]);
    }
  }
};

async function refreshSection(section: string, env: Env): Promise<void> {
  try {
    const sources = getFeedsBySection(section);
    const items = await fetchAllFeeds(sources);
    
    const clusters = clusterNewsItems(items, 0.18); // Optimal threshold

    // Define trusted sources that can show single-source stories
    const trustedSources = {
      'australia': ['ABC News Australia', 'ABC Just In', 'ABC News Australia (Popular)'],
      'technology': ['Ars Technica', 'Ars Technica Main']
    };

    // Filter clusters based on section rules
    let filteredClusters = clusters;
    if (['global', 'australia', 'technology'].includes(section)) {
      filteredClusters = clusters.filter(cluster => {
        // Always include multi-source clusters
        if (cluster.coverage >= 2) return true;
        
        // For single-source clusters, only include if from trusted sources
        if (section in trustedSources) {
          const trusted = trustedSources[section as keyof typeof trustedSources];
          return cluster.items.some(item => trusted.includes(item.source));
        }
        
        return false;
      });
    }

    // Only supplement with scraped articles if we have insufficient single-source trusted content
    if ((section === 'australia' || section === 'technology') && filteredClusters.filter(c => c.coverage === 1).length < 5) {
      const scrapedArticles = await fetchScrapedPopularArticles();
      
      // Filter scraped articles by section
      const sectionScrapedArticles = scrapedArticles.filter(article => {
        if (section === 'australia') {
          return article.source.includes('ABC News Australia');
        }
        if (section === 'technology') {
          return article.source === 'Ars Technica';
        }
        return false;
      });
      
      // Create clusters from scraped articles (they won't cluster with RSS items due to different sources)
      const scrapedClusters = clusterNewsItems(sectionScrapedArticles, 0.18);
      
      // Add scraped clusters that don't duplicate existing content
      const existingUrls = new Set(filteredClusters.flatMap(c => c.items.map(i => i.url)));
      const newScrapedClusters = scrapedClusters.filter(cluster => 
        !cluster.items.some(item => existingUrls.has(item.url))
      );
      
      filteredClusters.push(...newScrapedClusters);
    }

    // Calculate popularity scores for each cluster
    filteredClusters.forEach(cluster => {
      cluster.popularity_score = calculatePopularityScore(cluster, section);
    });

    // Sort by popularity score (higher = more popular)
    filteredClusters.sort((a, b) => {
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    });

    // Temporarily disable AI processing to debug CPU timeout issues
    console.log(`Skipping AI processing for all ${filteredClusters.length} clusters to avoid CPU timeout`);

    const data: SectionData = {
      updated_at: new Date().toISOString(),
      clusters: filteredClusters.slice(0, 50) // Limit to top 50 clusters
    };

    await env.NEWS_KV.put(`news:${section}`, JSON.stringify(data), {
      expirationTtl: 86400 // 24 hours
    });
  } catch (error) {
    console.error(`Error refreshing ${section}:`, error);
  }
}

async function refreshMedicalSections(env: Env): Promise<void> {
  try {
    // Refresh each medical subsection
    const subsections = ['clinical', 'professional', 'patient_signals'];
    
    await Promise.all(subsections.map(async (subsection) => {
      const sources = getFeedsBySection('medical', subsection);
      const items = await fetchAllFeeds(sources);
      const clusters = clusterNewsItems(items, 0.18); // Optimal threshold

      const data: SectionData = {
        updated_at: new Date().toISOString(),
        clusters: subsection === 'clinical' || subsection === 'professional' 
          ? clusters.slice(0, 5) // Only 5 for RACGP sections
          : clusters.slice(0, 20) // More for patient signals
      };

      await env.NEWS_KV.put(`news:medical:${subsection}`, JSON.stringify(data), {
        expirationTtl: 86400
      });
    }));

    // Handle month in research separately (would be scraped from EvidenceAlerts)
    const researchItems = await fetchEvidenceAlerts();
    const researchData: SectionData = {
      updated_at: new Date().toISOString(),
      clusters: [] // Would contain research articles
    };

    await env.NEWS_KV.put('news:medical:month_in_research', JSON.stringify(researchData), {
      expirationTtl: 86400
    });
  } catch (error) {
    console.error('Error refreshing medical sections:', error);
  }
}

function calculatePopularityScore(cluster: NewsCluster, section: string): number {
  let score = 0;
  
  // Base score from coverage (multi-source stories are inherently more popular)
  // Multi-source articles get much higher base scores to ensure they always rank above single-source
  if (cluster.coverage >= 2) {
    score += cluster.coverage * 1000; // 2000+ for 2-source, 3000+ for 3-source, etc.
  } else {
    score += 100; // Single-source articles start much lower
  }
  
  // For single-source trusted articles, use content-based popularity indicators
  if (cluster.coverage === 1) {
    const item = cluster.items[0];
    
    // Higher bonus for scraped articles (they come from "popular" sections)
    if (item.feed_position !== undefined && item.feed_position < 10) {
      // Scraped articles get massive bonus since they're from curated popular sections
      score += 200 - (item.feed_position * 10); // First scraped article gets 200, second gets 190, etc.
    }
    
    // Bonus for trusted sources (these are allowed single-source articles)
    const trustedSources = {
      'australia': ['ABC News Australia', 'ABC Just In', 'ABC News Australia (Popular)'],
      'technology': ['Ars Technica', 'Ars Technica Main']
    };
    
    if (section in trustedSources) {
      const trusted = trustedSources[section as keyof typeof trustedSources];
      if (trusted.includes(item.source)) {
        score += 30; // Trusted source bonus
      }
    }
    
    // Content quality and popularity indicators
    const title = item.title.toLowerCase();
    const content = (item.standfirst || item.content || '').toLowerCase();
    
    // Technology-specific popularity indicators
    if (section === 'technology') {
      // High interest tech topics
      if (title.includes('ai') || title.includes('artificial intelligence') || title.includes('chatgpt') || title.includes('gpt')) score += 15;
      if (title.includes('apple') || title.includes('iphone') || title.includes('google') || title.includes('microsoft')) score += 12;
      if (title.includes('security') || title.includes('privacy') || title.includes('hack')) score += 10;
      if (title.includes('climate') || title.includes('space') || title.includes('mars')) score += 8;
      if (title.includes('bitcoin') || title.includes('crypto') || title.includes('blockchain')) score += 8;
      if (title.includes('tesla') || title.includes('electric') || title.includes('ev')) score += 6;
      
      // Content type indicators
      if (title.includes('review') || title.includes('test')) score += 5;
      if (title.includes('breaking') || title.includes('exclusive')) score += 8;
    }
    
    // Australia-specific popularity indicators  
    if (section === 'australia') {
      // High interest topics
      if (title.includes('election') || title.includes('politics') || title.includes('government')) score += 12;
      if (title.includes('economy') || title.includes('housing') || title.includes('interest rate')) score += 10;
      if (title.includes('climate') || title.includes('bushfire') || title.includes('flood')) score += 8;
      if (title.includes('sydney') || title.includes('melbourne') || title.includes('brisbane')) score += 6;
      if (title.includes('sport') || title.includes('afl') || title.includes('nrl')) score += 5;
      
      // News type indicators
      if (title.includes('breaking') || title.includes('live') || title.includes('urgent')) score += 10;
      if (title.includes('exclusive') || title.includes('investigation')) score += 8;
    }
    
    // Length and quality indicators (longer titles often indicate more significant stories)
    if (title.length > 50 && title.length < 120) score += 3;
    
    // Avoid less newsworthy content
    if (title.includes('weather') || title.includes('traffic')) score -= 5;
    if (title.includes('sport') && section !== 'australia') score -= 3; // Sports less relevant in tech
  }
  
  // Recency factor (more recent = slightly higher score)
  const hoursOld = (Date.now() - new Date(cluster.updated_at).getTime()) / (1000 * 60 * 60);
  const recencyBonus = Math.max(0, 20 - hoursOld); // Up to 20 points for very recent stories
  score += recencyBonus;
  
  return score;
}