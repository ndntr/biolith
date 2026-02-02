# Aninda News Processor

GitHub Actions-based news processing system for aninda.org

## Overview

This repository processes RSS feeds from 40+ international news sources, performs intelligent clustering, and generates AI-powered summaries using Google Gemini API. The processed data is stored as JSON files and served via Cloudflare Workers.

## Architecture

- **GitHub Actions**: Processes RSS feeds every 4 hours
- **Google Gemini API**: Generates 5-bullet point summaries using Gemini 1.5 Flash
- **JSON Storage**: Processed data stored in `/data` directory
- **Cloudflare Workers**: Lightweight API to serve processed data

## Sections

- **Global**: 23 international news sources
- **Australia**: 8 Australian news sources  
- **Technology**: 10 technology news sources
- **Medical**: 3 medical/health news sources

## Processing Features

- **Multi-source clustering**: Groups related articles from different sources
- **Popularity scoring**: Ranks stories by significance and coverage
- **AI summaries**: 5-bullet point summaries with proper attribution
- **Trusted sources**: Single-source articles from verified outlets
- **Web scraping**: Supplements RSS with popular article sections

## Setup

### For Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your-actual-api-key-here
   ```
   Optional overrides:
   ```
   GEMINI_MODEL=gemini-2.0-flash
   GEMINI_API_VERSION=v1
   ```
   Get your API key from: https://aistudio.google.com/app/apikey

3. Run the processor:
   ```bash
   npm run process-news
   ```

### For GitHub Actions (Production)

1. Go to your repository Settings → Secrets and variables → Actions
2. Add a new repository secret:
   - Name: `GEMINI_API_KEY`
   - Value: Your Google Gemini API key
3. Optional repository secrets:
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)
   - `GEMINI_API_VERSION` (default: `v1`)

3. GitHub Actions will automatically:
   - Run every 4 hours
   - Process all RSS feeds  
  - Generate AI summaries using the configured Gemini model (defaults to `gemini-2.0-flash`)
   - Commit updated JSON files

**IMPORTANT**: Never commit your actual API key to the repository!

## Manual Trigger

To manually trigger processing:
1. Go to Actions tab
2. Select "Process News Feeds"
3. Click "Run workflow"

## Data Files

- `data/global.json`: Global news clusters
- `data/australia.json`: Australian news clusters  
- `data/technology.json`: Technology news clusters
- `data/medical.json`: Medical news data (4 subsections)# Force workflow recognition
