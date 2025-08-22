#!/usr/bin/env node

/**
 * Test RSS Feed Integration
 * 
 * Quick test to verify the RSS fetcher works with the Kill the Newsletter feed.
 */

import { RSSFetcher } from '../dist/rss-fetcher.js';
import { log } from '../dist/utils.js';

async function testRSSIntegration() {
  log('🧪 Testing RSS Integration...');
  
  // Check environment variable
  const rssUrl = process.env.EVIDENCE_ALERTS_RSS_URL;
  
  if (!rssUrl) {
    log('❌ Missing EVIDENCE_ALERTS_RSS_URL environment variable', 'error');
    log('Make sure you have set up Kill the Newsletter and added the RSS URL to your environment.', 'error');
    process.exit(1);
  }
  
  log(`📡 Using RSS URL: ${rssUrl.substring(0, 50)}...`);
  
  try {
    const fetcher = new RSSFetcher(rssUrl);
    
    // Test connection
    log('Testing RSS feed connection...');
    const connectionOk = await fetcher.testConnection();
    
    if (!connectionOk) {
      log('❌ RSS feed connection failed', 'error');
      process.exit(1);
    }
    
    // Get feed info
    log('Getting RSS feed information...');
    const feedInfo = await fetcher.getFeedInfo();
    log(`📬 Feed has ${feedInfo.itemCount} items`);
    if (feedInfo.title) {
      log(`   Title: ${feedInfo.title}`);
    }
    
    // Fetch articles
    log('Fetching articles from RSS feed...');
    const articles = await fetcher.fetchLatestEvidenceArticles();
    
    if (articles.length === 0) {
      log('⚠️  No articles found in RSS feed - this might be normal if no new emails have been processed', 'warn');
    } else {
      log(`✅ Successfully fetched ${articles.length} articles:`);
      articles.slice(0, 3).forEach((article, index) => {
        log(`   ${index + 1}. ${article.title.substring(0, 60)}...`);
        log(`      Journal: ${article.journal}`);
        log(`      Score: ${article.score}`);
        log(`      Tags: ${article.tags.join(', ')}`);
      });
      
      if (articles.length > 3) {
        log(`   ... and ${articles.length - 3} more articles`);
      }
    }
    
    log('🎉 RSS integration test completed successfully!');
    
  } catch (error) {
    log(`❌ RSS integration test failed: ${error.message}`, 'error');
    if (error.message.includes('fetch')) {
      log('This might be a network issue or invalid RSS URL.', 'error');
    }
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRSSIntegration();
}

export { testRSSIntegration };