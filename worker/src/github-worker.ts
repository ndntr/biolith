import { Env, SectionData, MedicalSectionData } from './types';

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

    // All endpoints now fetch from GitHub-generated JSON files
    if (request.method === 'GET') {
      const githubBaseUrl = 'https://raw.githubusercontent.com/ndntr/actua-news-processor/master/data';
      
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

        // Fetch data from GitHub
        const response = await fetch(dataUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }

        const data = await response.text();
        
        return new Response(data, {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=900', // Cache for 15 minutes
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

    return new Response('Not Found', { status: 404 });
  },

  // Remove scheduled handler since processing now happens in GitHub Actions
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // GitHub Actions now handles all scheduled processing
    console.log('Scheduled processing moved to GitHub Actions');
  }
};