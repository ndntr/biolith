# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a news aggregation system for biolith.org with two main components:

- **Root directory**: Static HTML news display site
- **obelisk-engine/**: News processing engine (TypeScript/Node.js)

## Development Commands

All development commands are run from the `obelisk-engine/` directory:

```bash
cd obelisk-engine
npm install                    # Install dependencies
npm run process-news          # Main command - process RSS feeds and generate AI summaries
npm run dev                   # Alias for process-news
npm run build                 # Compile TypeScript
npm run test:local            # Run local tests
npm run test:process          # Test processing only
npm run test:serve            # Test serving only
npm run test:quota            # Test quota tracking
npm run test:pipeline         # Test full pipeline
npm run local                 # Build and test locally
```

## Architecture Overview

The system follows this data flow:
1. **RSS Feed Processing**: Fetches from 40+ international news sources
2. **Clustering**: Groups related articles using similarity algorithms
3. **AI Summarization**: Generates 5-bullet summaries using Google Gemini API
4. **Data Storage**: Saves processed data as JSON files in `data/` directory
5. **Static Serving**: HTML frontend displays the processed news

### Key Components

- **src/github-processor.ts**: Main entry point and orchestration
- **src/feeds.ts**: RSS feed source definitions
- **src/fetcher.ts**: RSS feed fetching logic
- **src/cluster.ts**: Article clustering algorithms
- **src/normalize.ts**: AI summarization with Gemini API
- **src/scraper.ts**: Web scraping for popular articles
- **src/types.ts**: TypeScript interfaces for news data

### Data Sections

- **Global**: 23 international news sources → `data/global.json`
- **Australia**: 8 Australian sources → `data/australia.json`
- **Technology**: 10 tech sources → `data/technology.json`
- **Medical**: 3 medical sources → `data/medical.json` (4 subsections)

## Environment Setup

The system requires a Google Gemini API key:

1. For local development: Create `.env` file with `GEMINI_API_KEY=your-key`
2. For GitHub Actions: Set `GEMINI_API_KEY` repository secret

## Automation

GitHub Actions automatically processes news every 4 hours (runs at 19:00, 23:00, 03:00, 07:00, 11:00 UTC) and commits updated JSON files to the repository.

## TypeScript Configuration

- Target: ES2021
- Uses CommonJS modules
- Cloudflare Workers types included
- Strict mode disabled for flexibility
- Output directory: `dist/`