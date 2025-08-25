# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Multi-engine news and evidence aggregation system for biolith.org:

- **Root directory**: Static HTML frontend displaying processed content
- **obelisk-engine/**: News aggregation engine (RSS feeds + AI summarization)
- **saltpile-engine/**: Evidence aggregation engine (EvidenceAlerts RSS processing)
- **scripts/js/**: Frontend JavaScript for content display
- **fonts/**, **images/**, **style.css**: Frontend assets

## Development Commands

### Obelisk Engine (News Processing)
All commands run from `obelisk-engine/` directory:

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

### Saltpile Engine (Evidence Processing)
All commands run from `saltpile-engine/` directory:

```bash
cd saltpile-engine
npm install                    # Install dependencies
npm run process               # Main command - fetch EvidenceAlerts RSS, get abstracts
npm run build                 # Compile TypeScript (outputs to dist/)
npm run test:local            # Run local tests with test email file
npm run test:fetch            # Test RSS feed connection only
npm run test:parse            # Test email parsing only
npm run test:scrape           # Test PubMed API integration only
npm run local                 # Build and test locally
```

## Architecture Overview

### Obelisk Engine: News Processing Pipeline

1. **RSS Feed Fetching** (`src/fetcher.ts`): Fetches from 40+ news sources defined in `src/feeds.ts`
2. **Article Clustering** (`src/cluster.ts`): Groups related articles using Jaccard similarity (threshold: 0.18)
3. **AI Summarization** (`src/normalize.ts`): Generates 5-bullet summaries via Google Gemini API with rate limiting
4. **Data Storage**: Outputs JSON files to `obelisk-engine/data/` directory
5. **Frontend Display**: `scripts/js/news-new.js` fetches and renders the JSON data

### Saltpile Engine: Evidence Processing Pipeline

1. **RSS Feed Fetching** (`src/rss-fetcher.ts`): Fetches EvidenceAlerts emails from Kill the Newsletter RSS
2. **Email Parsing** (`src/email-parser.ts`): Extracts articles with scores and metadata from email content
3. **PubMed Integration** (`src/pubmed-fetcher.ts`): Fetches abstracts and metadata using PubMed API
4. **Fuzzy Deduplication** (`src/deduplication.ts`): Handles US/UK spelling variations in medical titles
5. **Data Storage**: Outputs evidence data to `saltpile-engine/data/evidence.json`
6. **Data Management**: Maintains 7-day rolling window, marks new articles (24h), limits to 50 articles

### Key Components

**Obelisk Engine:**
- **src/github-processor.ts**: Main orchestrator, processes all sections
- **src/feeds.ts**: Defines RSS feeds for global, australia, technology, medical sections
- **src/cluster.ts**: Implements article clustering with similarity algorithms
- **src/normalize.ts**: Handles text normalization and Gemini API integration
- **src/request-queue.ts**: Rate limiting for API requests
- **src/quota-tracker.ts**: Tracks API quota usage
- **src/types.ts**: TypeScript interfaces (NewsItem, NewsCluster, SectionData)

**Saltpile Engine:**
- **src/index.ts**: Main engine class with CLI interface and processing pipeline
- **src/rss-fetcher.ts**: RSS feed fetching from Kill the Newsletter
- **src/email-parser.ts**: Email content parsing for EvidenceAlerts format
- **src/evidence-scraper.ts**: Evidence data scraping utilities
- **src/pubmed-fetcher.ts**: PubMed API integration for abstract fetching
- **src/deduplication.ts**: Fuzzy matching with medical spelling normalization
- **src/types.ts**: TypeScript interfaces (EvidenceArticle, EvidenceData, ProcessingOptions)
- **src/utils.ts**: Utility functions for article processing

### Data Sections

**Obelisk Engine Output:**
- **Global**: 23 international sources → `obelisk-engine/data/global.json`
- **Australia**: 8 Australian sources → `obelisk-engine/data/australia.json`  
- **Technology**: 10 tech sources → `obelisk-engine/data/technology.json`
- **Medical**: 3 sources → `obelisk-engine/data/medical.json` (subsections: clinical, professional, patient_signals, month_in_research)

**Saltpile Engine Output:**
- **Evidence**: EvidenceAlerts articles → `saltpile-engine/data/evidence.json`

### Clustering Rules

- Multi-source clusters (coverage ≥ 2) always included
- Single-source clusters only from trusted sources:
  - Australia: ABC News Australia, ABC Just In, ABC News Australia (Popular)
  - Technology: Ars Technica, Ars Technica Main

## Environment Setup

### Obelisk Engine
Requires Google Gemini API key:
- **Local development**: Create `obelisk-engine/.env` with `GEMINI_API_KEY=your-key`
- **GitHub Actions**: Set `GEMINI_API_KEY` repository secret

### Saltpile Engine
Requires EvidenceAlerts RSS URL (from Kill the Newsletter):
- **Local development**: Create `saltpile-engine/.env` with `EVIDENCE_ALERTS_RSS_URL=your-rss-url`
- **GitHub Actions**: Set `EVIDENCE_ALERTS_RSS_URL` repository secret
- **Test mode**: Place test email files in `saltpile-engine/test-email.eml` (or specify custom path)

## TypeScript Configuration

**Obelisk Engine:**
- Target: ES2021, Module: CommonJS
- Types: Cloudflare Workers, Node.js
- Strict mode: disabled
- Output: `obelisk-engine/dist/`

**Saltpile Engine:**
- Target: ES2021, Module: ESNext
- Types: Node.js only
- Strict mode: disabled
- Output: `saltpile-engine/dist/`

## Automation

**News Processing** (`.github/workflows/process-news.yml`):
- Runs every 4 hours: 19:00, 23:00, 03:00, 07:00, 11:00 UTC (AEDT times)
- Processes obelisk-engine news and commits updated JSON files
- Uses Node.js 20, Ubuntu latest
- Requires `GEMINI_API_KEY` secret

**Evidence Processing** (`.github/workflows/process-evidence.yml`):
- Runs daily at 23:00 UTC (10am AEDT)
- Processes EvidenceAlerts RSS feed from Kill the Newsletter
- Requires `EVIDENCE_ALERTS_RSS_URL` and `GEMINI_API_KEY` secrets

## Module Systems

- **Obelisk Engine**: Uses CommonJS (`require`/`module.exports`)
- **Saltpile Engine**: Uses ES Modules (`import`/`export`) 
- Both engines compile TypeScript to their respective module formats