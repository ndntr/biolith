#!/usr/bin/env node

/**
 * Inspect Real RSS Feed Content
 * 
 * This script helps debug what's actually in the production RSS feed
 * and why the parser might not be finding EvidenceAlerts articles.
 */

import { RSSFetcher } from '../dist/rss-fetcher.js';
import { extractArticlesFromHtml } from '../dist/email-parser.js';
import { log } from '../dist/utils.js';
import fs from 'fs';

async function inspectRSSFeed() {
  log('🔍 Inspecting Production RSS Feed...');
  
  // Check environment variable
  const rssUrl = process.env.EVIDENCE_ALERTS_RSS_URL;
  
  if (!rssUrl) {
    log('❌ Missing EVIDENCE_ALERTS_RSS_URL environment variable', 'error');
    log('Please set the RSS URL to inspect the production feed.', 'error');
    process.exit(1);
  }
  
  log(`📡 Inspecting RSS URL: ${rssUrl.substring(0, 50)}...`);
  
  try {
    // Fetch raw RSS content
    log('Fetching raw RSS content...');
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();
    log(`📄 Raw RSS content (${xmlContent.length} characters)`);
    
    // Save raw content for inspection
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawFile = `debug-rss-raw-${timestamp}.xml`;
    fs.writeFileSync(rawFile, xmlContent);
    log(`💾 Saved raw RSS content to: ${rawFile}`);
    
    // Parse with XMLParser
    const { XMLParser } = await import('fast-xml-parser');
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: true
    });
    
    const parsedFeed = xmlParser.parse(xmlContent);
    
    // Save parsed structure for inspection
    const structureFile = `debug-rss-structure-${timestamp}.json`;
    fs.writeFileSync(structureFile, JSON.stringify(parsedFeed, null, 2));
    log(`💾 Saved parsed RSS structure to: ${structureFile}`);
    
    // Analyze the structure
    log('🔬 Analyzing RSS structure...');
    log(`Root keys: ${Object.keys(parsedFeed).join(', ')}`);
    
    if (parsedFeed.rss?.channel) {
      const channel = parsedFeed.rss.channel;
      log(`Channel title: ${channel.title || 'Unknown'}`);
      log(`Channel description: ${channel.description || 'Unknown'}`);
      
      const items = channel.item;
      const itemArray = Array.isArray(items) ? items : (items ? [items] : []);
      log(`Found ${itemArray.length} RSS items`);
      
      // Inspect each item
      itemArray.forEach((item, index) => {
        log(`\n📨 RSS Item ${index + 1}:`);
        log(`  Title: ${item.title || 'No title'}`);
        log(`  PubDate: ${item.pubDate || 'No date'}`);
        log(`  Description length: ${item.description ? item.description.length : 0} characters`);
        
        if (item.description) {
          // Look for EvidenceAlerts patterns
          const hasEvidenceLinks = item.description.includes('plus.mcmaster.ca/EvidenceAlerts');
          const hasTableStructure = item.description.includes('<table');
          const hasArticleLinks = item.description.includes('<a href=');
          
          log(`  Contains EvidenceAlerts links: ${hasEvidenceLinks}`);
          log(`  Contains table structure: ${hasTableStructure}`);
          log(`  Contains article links: ${hasArticleLinks}`);
          
          // Count potential article links
          const evidenceLinks = (item.description.match(/plus\.mcmaster\.ca\/EvidenceAlerts\/LFE\/Article/g) || []).length;
          log(`  EvidenceAlerts article count: ${evidenceLinks}`);
          
          // Save individual item content for inspection
          const itemFile = `debug-rss-item-${index + 1}-${timestamp}.html`;
          fs.writeFileSync(itemFile, item.description);
          log(`  💾 Saved item content to: ${itemFile}`);
          
          // Try parsing this item's HTML content
          log(`  🧪 Testing parser on this item...`);
          try {
            const articles = extractArticlesFromHtml(item.description);
            log(`  📄 Parser found ${articles.length} articles`);
            
            if (articles.length > 0) {
              articles.forEach((article, artIndex) => {
                log(`    ${artIndex + 1}. ${article.title.substring(0, 60)}...`);
                log(`       Journal: ${article.journal}`);
                log(`       Score: ${article.score}`);
                log(`       Tags: ${article.tags.join(', ')}`);
              });
            }
          } catch (parseError) {
            log(`  ❌ Parser error: ${parseError.message}`, 'error');
          }
        }
      });
    } else {
      log('❌ Unexpected RSS structure - no rss.channel found');
      log(`Available paths: ${JSON.stringify(Object.keys(parsedFeed), null, 2)}`);
    }
    
    // Test the full RSSFetcher
    log('\n🧪 Testing RSSFetcher...');
    const fetcher = new RSSFetcher(rssUrl);
    const articles = await fetcher.fetchLatestEvidenceArticles();
    
    log(`🎯 RSSFetcher returned ${articles.length} articles total`);
    if (articles.length > 0) {
      articles.forEach((article, index) => {
        log(`  ${index + 1}. ${article.title.substring(0, 60)}...`);
        log(`     Journal: ${article.journal}`);
        log(`     Score: ${article.score}`);
        log(`     Tags: ${article.tags.join(', ')}`);
      });
    }
    
    log('\n✅ RSS inspection completed successfully!');
    log(`📁 Check the debug files for detailed analysis:`);
    log(`   • ${rawFile} - Raw RSS XML`);
    log(`   • ${structureFile} - Parsed RSS structure`);
    itemArray.forEach((_, index) => {
      log(`   • debug-rss-item-${index + 1}-${timestamp}.html - Item ${index + 1} HTML content`);
    });
    
  } catch (error) {
    log(`❌ RSS inspection failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  inspectRSSFeed();
}

export { inspectRSSFeed };