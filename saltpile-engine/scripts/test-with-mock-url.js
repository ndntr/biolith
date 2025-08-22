#!/usr/bin/env node

/**
 * Test RSS parser with various mock scenarios to understand different edge cases
 */

import { RSSFetcher } from '../dist/rss-fetcher.js';
import { log } from '../dist/utils.js';
import fs from 'fs';
import { createServer } from 'http';

// Different test scenarios
const scenarios = {
  // Scenario 1: Empty RSS feed
  empty: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty EvidenceAlerts Feed</title>
    <description>RSS feed with no items</description>
    <link>https://kill-the-newsletter.com</link>
  </channel>
</rss>`,

  // Scenario 2: RSS with content but no EvidenceAlerts links
  noEvidenceLinks: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Non-EvidenceAlerts Feed</title>
    <description>RSS feed with content but no EvidenceAlerts</description>
    <link>https://kill-the-newsletter.com</link>
    <item>
      <title>Some other email content</title>
      <description><![CDATA[
        <html>
          <body>
            <p>This is some email content that doesn't contain EvidenceAlerts.</p>
            <a href="https://example.com/article">Regular article link</a>
            <p>More content here...</p>
          </body>
        </html>
      ]]></description>
      <link>https://kill-the-newsletter.com/entries/test1</link>
      <guid>test-item-1</guid>
      <pubDate>Thu, 22 Aug 2025 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,

  // Scenario 3: Malformed HTML structure
  malformedStructure: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Malformed EvidenceAlerts Feed</title>
    <description>RSS feed with EvidenceAlerts links but wrong structure</description>
    <link>https://kill-the-newsletter.com</link>
    <item>
      <title>Malformed EvidenceAlerts email</title>
      <description><![CDATA[
        <html>
          <body>
            <div>
              <a href="https://plus.mcmaster.ca/EvidenceAlerts/LFE/Article/12345">
                Article Title Without Proper Structure
              </a>
              <span>Some journal name</span>
              <span>Score info</span>
            </div>
          </body>
        </html>
      ]]></description>
      <link>https://kill-the-newsletter.com/entries/test2</link>
      <guid>test-item-2</guid>
      <pubDate>Thu, 22 Aug 2025 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,

  // Scenario 4: Text-only content (no HTML)
  textOnly: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Text-only Feed</title>
    <description>RSS feed with plain text content</description>
    <link>https://kill-the-newsletter.com</link>
    <item>
      <title>Text-only email</title>
      <description>This is plain text content without any HTML tags or EvidenceAlerts links.</description>
      <link>https://kill-the-newsletter.com/entries/test3</link>
      <guid>test-item-3</guid>
      <pubDate>Thu, 22 Aug 2025 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
};

class MockScenarioServer {
  constructor() {
    this.server = null;
    this.port = 3003;
  }

  start() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        const scenarioName = req.url?.replace('/', '') || 'empty';
        
        if (scenarios[scenarioName]) {
          res.writeHead(200, { 
            'Content-Type': 'application/xml',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(scenarios[scenarioName]);
        } else {
          res.writeHead(404);
          res.end(`Scenario not found. Available: ${Object.keys(scenarios).join(', ')}`);
        }
      });

      this.server.listen(this.port, () => {
        log(`📡 Mock scenario server started on http://localhost:${this.port}/`);
        log(`Available scenarios: ${Object.keys(scenarios).join(', ')}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      log('🛑 Mock scenario server stopped');
    }
  }

  getUrl(scenario = 'empty') {
    return `http://localhost:${this.port}/${scenario}`;
  }
}

async function testScenario(server, scenarioName) {
  log(`\n🧪 Testing scenario: ${scenarioName}`);
  log(''.padEnd(50, '='));
  
  try {
    const fetcher = new RSSFetcher(server.getUrl(scenarioName));
    
    // Get feed info
    const feedInfo = await fetcher.getFeedInfo();
    log(`📬 Feed: "${feedInfo.title}" with ${feedInfo.itemCount} items`);
    
    // Fetch articles
    const articles = await fetcher.fetchLatestEvidenceArticles();
    
    if (articles.length === 0) {
      log('⚠️  No articles found - this may be expected for this scenario');
    } else {
      log(`✅ Found ${articles.length} articles:`);
      articles.forEach((article, index) => {
        log(`   ${index + 1}. ${article.title.substring(0, 60)}...`);
        log(`      📖 Journal: ${article.journal}`);
        log(`      ⭐ Score: ${article.score}`);
        log(`      🏷️  Tags: ${article.tags.join(', ')}`);
      });
    }
    
  } catch (error) {
    log(`❌ Scenario failed: ${error.message}`, 'error');
  }
}

async function testAllScenarios() {
  log('🧪 Testing RSS Parser with Various Mock Scenarios...');
  
  const server = new MockScenarioServer();
  
  try {
    await server.start();
    
    // Test each scenario
    for (const scenarioName of Object.keys(scenarios)) {
      await testScenario(server, scenarioName);
    }
    
    log('\n✅ All scenario tests completed!');
    log('\n📋 Summary:');
    log('   • empty: Tests RSS with no items');
    log('   • noEvidenceLinks: Tests RSS with content but no EvidenceAlerts');
    log('   • malformedStructure: Tests EvidenceAlerts links with wrong HTML structure');
    log('   • textOnly: Tests RSS with plain text content');
    
  } catch (error) {
    log(`❌ Test failed: ${error.message}`, 'error');
  } finally {
    server.stop();
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAllScenarios();
}

export { testAllScenarios };