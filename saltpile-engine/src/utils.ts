import crypto from 'crypto';
import { generateNormalizedId } from './deduplication.js';

/**
 * Generate a unique ID for an evidence article based on title and journal
 * Maintains backward compatibility with existing IDs
 */
export function generateArticleId(title: string, journal: string): string {
  const content = `${title.trim()}_${journal.trim()}`;
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 12);
}

/**
 * Generate both exact and normalized IDs for deduplication
 */
export function generateArticleIds(title: string, journal: string): {
  id: string;
  normalizedId: string;
} {
  return {
    id: generateArticleId(title, journal),
    normalizedId: generateNormalizedId(title, journal)
  };
}

/**
 * Check if an article was received within the last 24 hours
 */
export function isArticleNew(dateReceived: string): boolean {
  const received = new Date(dateReceived);
  const now = new Date();
  const hoursDiff = (now.getTime() - received.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 24;
}

/**
 * Clean and normalize text content
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .replace(/\r\n/g, ' ')  // Replace line breaks
    .replace(/\n/g, ' ')    // Replace newlines
    .trim();
}

/**
 * Extract tags from the "Tagged for:" text
 */
export function parseTags(tagText: string): string[] {
  // Remove "Tagged for:" prefix and split by comma
  const cleaned = tagText.replace(/^Tagged for:\s*/i, '');
  return cleaned
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

/**
 * Add delay for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate that a URL is from EvidenceAlerts
 */
export function isValidEvidenceAlertsUrl(url: string): boolean {
  return url.includes('plus.mcmaster.ca/EvidenceAlerts/');
}

/**
 * Log with timestamp
 */
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}