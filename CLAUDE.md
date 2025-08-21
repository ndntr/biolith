# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

News aggregation and AI summarization system for biolith.org:

- **Root directory**: Static HTML frontend displaying processed news
- **obelisk-engine/**: News processing engine (TypeScript/Node.js)
- **scripts/js/**: Frontend JavaScript for news display
- **fonts/**, **images/**, **style.css**: Frontend assets

## Development Commands

All development commands run from `obelisk-engine/` directory:

```bash
cd obelisk-engine
npm install                    # Install dependencies
npm run process-news          # Main command - fetch RSS, cluster, summarize with AI
npm run dev                   # Alias for process-news
npm run build                 # Compile TypeScript (outputs to dist/)
npm run test:local            # Run local tests
npm run test:process          # Test processing only
npm run test:serve            # Test serving only
npm run test:quota            # Test quota tracking
npm run test:pipeline         # Test full pipeline
npm run local                 # Build and test locally
```

## Architecture Overview

### Data Processing Pipeline

1. **RSS Feed Fetching** (`src/fetcher.ts`): Fetches from 40+ news sources defined in `src/feeds.ts`
2. **Article Clustering** (`src/cluster.ts`): Groups related articles using Jaccard similarity (threshold: 0.18)
3. **AI Summarization** (`src/normalize.ts`): Generates 5-bullet summaries via Google Gemini API with rate limiting
4. **Data Storage**: Outputs JSON files to `obelisk-engine/data/` directory
5. **Frontend Display**: `scripts/js/news-new.js` fetches and renders the JSON data

### Key Components

- **src/github-processor.ts**: Main orchestrator, processes all sections
- **src/feeds.ts**: Defines RSS feeds for global, australia, technology, medical sections
- **src/cluster.ts**: Implements article clustering with similarity algorithms
- **src/normalize.ts**: Handles text normalization and Gemini API integration
- **src/request-queue.ts**: Rate limiting for API requests
- **src/quota-tracker.ts**: Tracks API quota usage
- **src/types.ts**: TypeScript interfaces (NewsItem, NewsCluster, SectionData)

### Data Sections

- **Global**: 23 international sources → `data/global.json`
- **Australia**: 8 Australian sources → `data/australia.json`  
- **Technology**: 10 tech sources → `data/technology.json`
- **Medical**: 3 sources → `data/medical.json` (subsections: clinical, professional, patient_signals, month_in_research)

### Clustering Rules

- Multi-source clusters (coverage ≥ 2) always included
- Single-source clusters only from trusted sources:
  - Australia: ABC News Australia, ABC Just In, ABC News Australia (Popular)
  - Technology: Ars Technica, Ars Technica Main

## Environment Setup

Requires Google Gemini API key:

- **Local development**: Create `obelisk-engine/.env` with `GEMINI_API_KEY=your-key`
- **GitHub Actions**: Set `GEMINI_API_KEY` repository secret

## TypeScript Configuration

- Target: ES2021
- Module: CommonJS
- Types: Cloudflare Workers, Node.js
- Strict mode: disabled
- Output: `obelisk-engine/dist/`

## Automation

GitHub Actions workflow (`.github/workflows/process-news.yml`):
- Runs every 4 hours: 19:00, 23:00, 03:00, 07:00, 11:00 UTC
- Processes news and commits updated JSON files
- Uses Node.js 20, Ubuntu latest

## TypeScript Configuration

- Target: ES2021
- Uses CommonJS modules
- Cloudflare Workers types included
- Strict mode disabled for flexibility
- Output directory: `dist/`