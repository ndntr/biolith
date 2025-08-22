# Saltpile Engine

EvidenceAlerts RSS feed ingestion and processing engine for Biolith medical research integration.

## Overview

Saltpile Engine processes EvidenceAlerts RSS feed to extract medical research articles and display them in the "New Evidence" section of the Biolith website. The RSS feed is generated from EvidenceAlerts emails using Kill the Newsletter service for improved security and reliability.

## Commands

```bash
npm install                # Install dependencies
npm run build             # Compile TypeScript
npm run process           # Fetch and process emails (main command)
npm run dev               # Alias for process
npm run test:local        # Test with local .eml file
npm run test:fetch        # Test email fetching only
npm run test:parse        # Test parsing only
npm run test:scrape       # Test scraping only
npm run local             # Build and test locally
```

## Environment Variables

### Required
- `EVIDENCE_ALERTS_RSS_URL`: RSS feed URL from Kill the Newsletter service

### Optional Testing
- `TEST_MODE`: Set to true for local testing
- `TEST_EMAIL_PATH`: Path to test .eml file

## RSS Setup via Kill the Newsletter

This engine uses [Kill the Newsletter](https://kill-the-newsletter.com/) to convert EvidenceAlerts emails into a secure RSS feed:

1. **Create RSS Feed:**
   - Visit [kill-the-newsletter.com](https://kill-the-newsletter.com/)
   - Create a new inbox - you'll get a unique email address and RSS feed URL

2. **Subscribe to EvidenceAlerts:**
   - Use the generated email address to subscribe to EvidenceAlerts
   - EvidenceAlerts emails will be converted to RSS automatically

3. **Configure Environment:**
   - Add the RSS feed URL to your environment as `EVIDENCE_ALERTS_RSS_URL`
   - For GitHub Actions: Add as repository secret
   - For local development: Add to `.env` file

## Benefits of RSS Approach

- **Security**: No email credentials needed, eliminates IMAP vulnerabilities
- **Reliability**: Standard HTTP/RSS instead of email protocols  
- **Simplicity**: No OAuth2 setup or credential management
- **Scalability**: Standard HTTP caching and CDN support

## Output

- `data/evidence.json`: Processed evidence articles in JSON format
- Updated daily via GitHub Actions workflow

## Architecture

- `src/index.ts`: Main orchestrator
- `src/rss-fetcher.ts`: RSS feed processing from Kill the Newsletter
- `src/email-parser.ts`: HTML article extraction (shared with RSS processing)
- `src/evidence-scraper.ts`: Scrape abstracts from EvidenceAlerts
- `src/pubmed-fetcher.ts`: Fetch abstracts from PubMed API
- `src/types.ts`: TypeScript interfaces
- `src/utils.ts`: Helper functions