import { Env, SectionData, MedicalSectionData } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    console.log('Worker received request:', path, request.method);

    // CORS headers - allow localhost for development
    const origin = request.headers.get('Origin');
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8888', 'http://127.0.0.1:8888'];
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

    // All endpoints now fetch from GitHub-generated JSON files
    if (request.method === 'GET') {
      // Use GitHub raw URLs for production, localhost for development
      const isLocal = corsOrigin?.includes('localhost') || corsOrigin?.includes('127.0.0.1');
      const githubBaseUrl = isLocal 
        ? 'http://localhost:8080/obelisk-engine/data'
        : 'https://raw.githubusercontent.com/ndntr/biolith/master/obelisk-engine/data';
      
      try {
        let dataUrl: string;
        
        if (path === '/news-api/global') {
          dataUrl = `${githubBaseUrl}/global.json`;
        } else if (path === '/news-api/australia') {
          dataUrl = `${githubBaseUrl}/australia.json`;
        } else if (path === '/news-api/technology') {
          dataUrl = `${githubBaseUrl}/technology.json`;
        } else if (path === '/news-api/medical') {
          dataUrl = `${githubBaseUrl}/medical.json`;
        } else if (path === '/news-api/health-today') {
          // Health Today uses the patient_signals data from medical.json
          const medicalResponse = await fetch(`${githubBaseUrl}/medical.json`);
          if (!medicalResponse.ok) {
            throw new Error(`Failed to fetch medical data: ${medicalResponse.status}`);
          }
          const medicalData = await medicalResponse.json() as MedicalSectionData;
          return new Response(JSON.stringify(medicalData.patient_signals || { clusters: [], updated_at: new Date().toISOString() }), {
            headers: corsHeaders
          });
        } else {
          return new Response('Not Found', { status: 404 });
        }

        // Fetch data from GitHub with cache-busting
        const cacheBuster = `?cb=${Date.now()}`;
        const response = await fetch(dataUrl + cacheBuster, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const data = await response.text();
        
        return new Response(data, {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60', // Cache for 5 minutes, allow stale for 1 min while revalidating
            'CDN-Cache-Control': 'max-age=300', // Cloudflare-specific cache control
          }
        });

      } catch (error) {
        console.error('Error fetching GitHub data:', error);
        
        // Return empty fallback data
        const fallbackData = {
          clusters: [],
          updated_at: new Date().toISOString()
        };

        return new Response(JSON.stringify(fallbackData), {
          headers: corsHeaders,
          status: 500
        });
      }
    }

    // Admin refresh endpoint - now just returns status (actual processing happens in GitHub Actions)
    if (request.method === 'POST' && path === '/news-api/admin/refresh') {
      const token = request.headers.get('X-NEWS-TOKEN');
      
      if (token !== env.NEWS_REFRESH_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }

      // Since processing now happens in GitHub Actions, we just return a message
      return new Response(JSON.stringify({
        ok: true,
        message: 'News processing now handled by GitHub Actions. Check the actua-news-processor repository for the latest updates.',
        github_actions_url: 'https://github.com/ndntr/actua-news-processor/actions',
        updated_at: new Date().toISOString()
      }), { headers: corsHeaders });
    }

    // Webhook endpoint for GitHub Actions to notify of updates
    if (request.method === 'POST' && path === '/news-api/webhook/update') {
      const token = request.headers.get('X-NEWS-TOKEN');
      
      if (token !== env.NEWS_REFRESH_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }

      // Purge Cloudflare cache for the API endpoints
      const purgeUrls = [
        'https://aninda.org/news-api/global',
        'https://aninda.org/news-api/australia', 
        'https://aninda.org/news-api/technology',
        'https://aninda.org/news-api/medical',
        'https://aninda.org/news-api/health-today'
      ];

      // Note: This would require Cloudflare API access to actually purge
      // For now, just acknowledge the webhook
      console.log('Webhook received - news data updated in GitHub');
      
      return new Response(JSON.stringify({
        ok: true,
        message: 'Update notification received',
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404 });
  },

  // Remove scheduled handler since processing now happens in GitHub Actions
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // GitHub Actions now handles all scheduled processing
    console.log('Scheduled processing moved to GitHub Actions');
  }
};