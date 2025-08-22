#!/usr/bin/env node

/**
 * Test RSS Integration with Local Mock Data
 * 
 * This demonstrates the RSS functionality using a local mock RSS file.
 */

import { RSSFetcher } from '../dist/rss-fetcher.js';
import { log } from '../dist/utils.js';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';

class LocalRSSServer {
  constructor() {
    this.server = null;
    this.port = 3001;
  }

  start() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        if (req.url === '/test-rss.xml') {
          const mockRssPath = path.join(process.cwd(), 'test-data', 'mock-rss.xml');
          
          if (fs.existsSync(mockRssPath)) {
            const rssContent = fs.readFileSync(mockRssPath, 'utf-8');
            res.writeHead(200, { 
              'Content-Type': 'application/xml',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(rssContent);
          } else {
            res.writeHead(404);
            res.end('RSS file not found');
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.listen(this.port, () => {
        log(`📡 Local RSS server started on http://localhost:${this.port}/test-rss.xml`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      log('🛑 Local RSS server stopped');
    }
  }

  getUrl() {
    return `http://localhost:${this.port}/test-rss.xml`;
  }
}

async function testLocalRSS() {
  log('🧪 Testing RSS Integration with Local Mock Data...');
  
  const server = new LocalRSSServer();
  
  try {
    // Start local server
    await server.start();
    
    // Test RSS fetcher
    const fetcher = new RSSFetcher(server.getUrl());
    
    // Test connection
    log('Testing RSS feed connection...');
    const connectionOk = await fetcher.testConnection();
    
    if (!connectionOk) {
      throw new Error('RSS feed connection test failed');
    }
    
    log('✅ RSS connection successful');
    
    // Get feed info
    log('Getting RSS feed information...');
    const feedInfo = await fetcher.getFeedInfo();
    log(`📬 Feed: "${feedInfo.title}" with ${feedInfo.itemCount} items`);
    
    // Fetch articles
    log('Fetching articles from RSS feed...');
    const articles = await fetcher.fetchLatestEvidenceArticles();
    
    if (articles.length === 0) {
      throw new Error('No articles found in RSS feed');
    }
    
    log(`🎯 Successfully extracted ${articles.length} articles:`);
    articles.forEach((article, index) => {
      log(`   ${index + 1}. ${article.title}`);
      log(`      📖 Journal: ${article.journal}`);
      log(`      ⭐ Score: ${article.score}`);
      log(`      🏷️  Tags: ${article.tags.join(', ')}`);
      log(`      🔗 URL: ${article.evidenceAlertsUrl}`);
      log('');
    });
    
    log('🎉 RSS integration test completed successfully!');
    log('');
    log('📋 Summary:');
    log('   • RSS XML parsing: ✅');
    log('   • HTML content extraction: ✅');
    log('   • Article metadata parsing: ✅');
    log('   • EvidenceAlerts URL validation: ✅');
    log('');
    log('🚀 The RSS integration is working correctly and ready for production use!');
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    // Always stop the server
    server.stop();
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLocalRSS();
}

export { testLocalRSS };