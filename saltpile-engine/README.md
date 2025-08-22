# Saltpile Engine

EvidenceAlerts email ingestion and processing engine for Biolith medical research integration.

## Overview

Saltpile Engine processes daily EvidenceAlerts emails to extract medical research articles and display them in the "New Evidence" section of the Biolith website.

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

- `INGEST_MAIL`: Gmail address for fetching emails
- `INGEST_MAIL_KEY`: Gmail app password
- `TEST_MODE`: Set to true for local testing
- `TEST_EMAIL_PATH`: Path to test .eml file

## Output

- `data/evidence.json`: Processed evidence articles in JSON format
- Updated daily via GitHub Actions workflow

## Architecture

- `src/index.ts`: Main orchestrator
- `src/email-fetcher.ts`: Gmail IMAP connection
- `src/email-parser.ts`: Parse .eml files  
- `src/evidence-scraper.ts`: Scrape abstracts from EvidenceAlerts
- `src/types.ts`: TypeScript interfaces
- `src/utils.ts`: Helper functions