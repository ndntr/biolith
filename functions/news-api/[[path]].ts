// Proxy function for Cloudflare Pages to route news API requests to our worker
export async function onRequest(context: any) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Extract the path after /news-api/
  const path = url.pathname.replace('/news-api', '');
  
  // Forward to our worker
  const workerUrl = `https://biolith-news.biolith.workers.dev/news-api${path}${url.search}`;
  
  // Create new request with same headers and body
  const newRequest = new Request(workerUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });
  
  return fetch(newRequest);
}