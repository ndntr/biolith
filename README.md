# Biolith News Aggregation System

News aggregation and AI summarization engine for biolith.org

## Components

- **obelisk-engine/**: News processing engine (RSS feeds + AI summarization)
- **worker/**: Cloudflare Worker API service
- **frontend/**: News display interface
- **functions/**: Cloudflare Pages API proxy functions

## Development

### News Processing
```bash
cd obelisk-engine
npm install
npm run process-news
```

### Worker Deployment
```bash
cd worker
npx wrangler deploy
```

### GitHub Actions
Automated news processing runs every 4 hours via GitHub Actions workflow.

## Architecture

RSS Feeds → obelisk-engine → GitHub Data → Cloudflare Worker → Frontend Display