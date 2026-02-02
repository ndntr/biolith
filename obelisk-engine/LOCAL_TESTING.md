# Local Testing Environment

This document explains how to set up and use the local testing environment for the news processing pipeline.

## Quick Start

1. **Set up environment**:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   export GEMINI_MODEL=gemini-2.0-flash
   export GEMINI_API_VERSION=v1
   ```

2. **Run comprehensive test**:
   ```bash
   npm run test:pipeline
   ```

3. **Start local development environment**:
   ```bash
   npm run local
   ```

This will process real RSS feeds, generate AI summaries, and start both frontend and API servers.

## Available Commands

### Full Environment
```bash
npm run local                # Build + process + start servers
npm run test:local          # Same as above (alias)
```

### Individual Operations
```bash
npm run test:process        # Only process feeds (no servers)
npm run test:serve          # Only start servers (no processing)
npm run test:quota          # Check Gemini API quota status
npm run test:pipeline       # Run comprehensive test suite
```

### Manual Commands
```bash
node test-local.js          # Full environment
node test-local.js process  # Process only
node test-local.js serve    # Serve only
node test-local.js quota    # Quota only
node test-pipeline.js       # Test suite
```

## What Happens When You Run `npm run local`

1. **Environment Check**: Verifies Node.js, API key, and dependencies
2. **Build**: Compiles TypeScript to JavaScript
3. **Quota Check**: Shows current Gemini API usage
4. **Feed Processing**: 
   - Fetches from all configured RSS feeds
   - Clusters similar articles
   - Generates AI headlines and summaries
   - Saves to `data/*.json` files
5. **Server Startup**:
   - Frontend server at http://localhost:8080/news.html
   - API server at http://localhost:8787

## Local Architecture

```
┌─────────────────────┐    ┌─────────────────────┐
│   news.html         │    │   Cloudflare        │
│   (Frontend)        │◄───┤   Worker API        │
│   localhost:8080    │    │   localhost:8787    │
└─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────┐
│              data/*.json files                  │
│   ┌─────────────┬─────────────┬─────────────┐   │
│   │ global.json │australia.json│technology.json│   │
│   └─────────────┴─────────────┴─────────────┘   │
└─────────────────────────────────────────────────┘
                    ▲
                    │
┌─────────────────────────────────────────────────┐
│         News Processing Pipeline                │
│  RSS Feeds → Clustering → AI Processing        │
└─────────────────────────────────────────────────┘
```

## Test Suite Details

The `test-pipeline.js` script runs comprehensive tests:

1. **Environment**: Node.js, API key, build status
2. **Build**: TypeScript compilation
3. **Quota Tracker**: Daily usage monitoring
4. **Feed Fetching**: RSS feed connectivity
5. **Clustering**: Article grouping algorithm
6. **Gemini API**: AI integration test
7. **Full Pipeline**: End-to-end processing
8. **Local Servers**: Development server setup

## Typical Output

```
📰 News Processor - Local Test Environment

🔍 Checking Environment
✓ Node.js version: v20.11.0
✓ GEMINI_API_KEY is set
✓ TypeScript compiled (dist/ exists)

📊 Gemini API Quota Status
Daily Quota: 25/200 requests used
Remaining: 175 requests
Resets at: 16/08/2025, 12:00:00 am

📰 Processing News Feeds
Processing 67 clusters in chunks of 15 with 3 concurrent requests
Quota status: 25/200 requests used today, 175 remaining
✓ Processing completed in 28.3s
  ✓ global.json: 23 clusters, 87.2KB
  ✓ australia.json: 18 clusters, 64.5KB
  ✓ technology.json: 15 clusters, 52.1KB
  ✓ medical.json: 11 clusters, 38.7KB

🚀 Starting Local Servers
✓ Frontend server running at http://localhost:8080/news.html
✓ API server running at http://localhost:8787

🎉 Local environment ready!
📰 Open: http://localhost:8080/news.html

Press Ctrl+C to stop all servers
```

## File Structure

```
aninda-news-processor/
├── test-local.js           # Local development environment
├── test-pipeline.js        # Comprehensive test suite
├── src/                    # TypeScript source
├── dist/                   # Compiled JavaScript
├── data/                   # Generated JSON files
│   ├── global.json
│   ├── australia.json
│   ├── technology.json
│   └── medical.json
├── news-worker/           # Cloudflare Worker API
├── .gemini-quota.json     # API usage tracking (auto-generated)
└── news.html             # Frontend interface
```

## Troubleshooting

### Common Issues

1. **API Key Missing**:
   ```bash
   export GEMINI_API_KEY=your_key_here
   ```
   Optional overrides:
   ```bash
   export GEMINI_MODEL=gemini-2.0-flash
   export GEMINI_API_VERSION=v1
   ```

2. **TypeScript Errors**:
   ```bash
   npm run build
   ```

3. **Port Already in Use**:
   - Kill existing servers: `lsof -ti:8080,8787 | xargs kill`
   - Or use different ports in the scripts

4. **Low Quota**:
   - Check usage: `npm run test:quota`
   - Wait for midnight Pacific reset
   - Consider upgrading to paid tier

5. **Feed Fetching Errors**:
   - Check internet connection
   - Some feeds may be temporarily unavailable
   - Pipeline continues with available feeds

### Debug Mode

Add debug logging by setting:
```bash
export DEBUG=1
npm run test:pipeline
```

## Production vs Local

| Aspect | Production | Local |
|--------|------------|-------|
| Trigger | GitHub Actions cron | Manual execution |
| Frequency | Every 4 hours | On demand |
| Data Storage | GitHub repository | Local files |
| API Access | Cloudflare Workers | localhost:8787 |
| Frontend | aninda.org | localhost:8080 |

## Performance Expectations

- **Feed Fetching**: ~800 articles in 10-15 seconds
- **Clustering**: ~60-80 clusters in 2-3 seconds  
- **AI Processing**: ~4-6 API requests in 15-30 seconds
- **Total Pipeline**: 30-60 seconds end-to-end
- **Startup Time**: 5-10 seconds for servers

## Next Steps

After successful local testing:

1. **Deploy Changes**: Commit and push to GitHub
2. **Monitor Actions**: Watch GitHub Actions workflow
3. **Verify Production**: Check aninda.org/news.html
4. **Scale if Needed**: Consider paid Gemini tier for higher limits
