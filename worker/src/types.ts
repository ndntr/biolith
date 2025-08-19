export interface NewsItem {
  source: string;
  url: string;
  published_at: string;
  title: string;
  standfirst?: string;
  content?: string;
  canonical_url?: string;
  feed_position?: number; // Position in the original RSS feed (0 = top)
}

export interface NewsCluster {
  id: string;
  coverage: number;
  updated_at: string;
  title: string;
  neutral_headline?: string;
  bullet_summary?: string[];
  ai_summary?: string; // AI-generated summary
  items: NewsItem[];
  popularity_score?: number; // Calculated popularity score for sorting
}

export interface SectionData {
  updated_at: string;
  clusters: NewsCluster[];
}

export interface MedicalSectionData {
  clinical: SectionData;
  professional: SectionData;
  patient_signals: SectionData;
  month_in_research: SectionData;
}

export interface FeedSource {
  name: string;
  url: string;
  type: 'rss' | 'api';
  section: 'global' | 'australia' | 'technology' | 'medical';
  subsection?: 'clinical' | 'professional' | 'patient_signals' | 'month_in_research';
}

export interface Env {
  NEWS_KV: KVNamespace;
  NEWS_REFRESH_TOKEN: string;
  ALLOWED_ORIGIN: string;
  AI?: any; // Cloudflare AI binding
}