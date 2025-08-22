export interface EvidenceArticle {
  id: string;
  title: string;
  journal: string;
  score: string;  // "6/7" format from EvidenceAlerts
  tags: string[];  // Medical specialties
  evidenceAlertsUrl: string;
  abstract?: string;  // Scraped from EvidenceAlerts page
  structuredAbstract?: Array<{label: string, text: string}>;  // Structured abstract from PubMed
  pubmedUrl?: string;  // Extracted from EvidenceAlerts page
  pubDate?: string;  // Publication date from PubMed
  doi?: string;  // DOI from PubMed
  dateReceived: string;  // ISO string
  isNew: boolean;  // True if received within 24 hours
}

export interface EvidenceData {
  updated_at: string;  // ISO string
  articles: EvidenceArticle[];
}

export interface EmailArticleData {
  title: string;
  journal: string;
  score: string;
  tags: string[];
  evidenceAlertsUrl: string;
}

export interface ProcessingOptions {
  testMode?: boolean;
  testEmailPath?: string;
  fetchOnly?: boolean;
  parseOnly?: boolean;
  scrapeOnly?: boolean;
}

export interface ImapConfig {
  host: string;
  port: number;
  tls: boolean;
  tlsOptions?: {
    rejectUnauthorized?: boolean;
    servername?: string;
  };
  user: string;
  password: string;
}

export interface ScrapedArticleData {
  abstract?: string;
  pubmedUrl?: string;
  fullTitle?: string;
  pmid?: string;
}