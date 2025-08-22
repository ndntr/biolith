#!/usr/bin/env node

/**
 * Debug RSS Parser to understand why EvidenceAlerts articles aren't being found
 */

import { RSSFetcher } from '../dist/rss-fetcher.js';
import { extractArticlesFromHtml } from '../dist/email-parser.js';
import { log } from '../dist/utils.js';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';

// Create a mock RSS feed with real EvidenceAlerts email structure
const realEmailStructure = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>EvidenceAlerts Real Feed</title>
    <description>RSS feed with real EvidenceAlerts email structure</description>
    <link>https://kill-the-newsletter.com</link>
    <item>
      <title>New articles from EvidenceAlerts for August 22, 2025</title>
      <description><![CDATA[
        <table border="0" cellpadding="5" cellspacing="0" width="100%" style="font-family: Arial;font-size: 16px;line-height: 125%">
          <tr bgcolor="#F8F8F8">
            <td align="left" colspan="2">
              <a href="https://plus.mcmaster.ca/EvidenceAlerts/LFE/Article/ce4e8711-d28c-49a6-8652-021a3edd4e7e/47842572/117411" style="text-decoration: none;color: #3f84ae;font-weight: bold;font-size: 1.1em;">
                Stapokibart for Severe Uncontrolled Chronic Rhinosinusitis With Nasal Polyps: The CROWNS-2 Randomized Clinical Trial.
              </a>
            </td>
          </tr>
          <tr bgcolor="#F8F8F8">
            <td align="left" width="50%">JAMA</td>
            <td align="right" width="50%">
              <img src="data:image/gif;base64,..." alt="Score: 6/7" style="max-width: 100%">
            </td>
          </tr>
          <tr bgcolor="#F8F8F8">
            <td align="left" colspan="2" style="font-size: 0.75em">
              Tagged for: Allergy and Immunology, Family Medicine (FM)/General Practice (GP)
            </td>
          </tr>
          <tr><td height="10" colspan="2"><!-- --></td></tr>
          
          <tr bgcolor="#F8F8F8">
            <td align="left" colspan="2">
              <a href="https://plus.mcmaster.ca/EvidenceAlerts/LFE/Article/ce4e8711-d28c-49a6-8652-021a3edd4e7e/47842572/117409" style="text-decoration: none;color: #3f84ae;font-weight: bold;font-size: 1.1em;">
                Effects of Prophylactic Oxytocin or Carbetocin on Troponin Release and Postpartum Haemorrhage at Planned Caesarean Delivery: A Double-Blind Randomised Controlled Trial.
              </a>
            </td>
          </tr>
          <tr bgcolor="#F8F8F8">
            <td align="left" width="50%">BJOG</td>
            <td align="right" width="50%">
              <img src="data:image/gif;base64,..." alt="Score: 5/7" style="max-width: 100%">
            </td>
          </tr>
          <tr bgcolor="#F8F8F8">
            <td align="left" colspan="2" style="font-size: 0.75em">
              Tagged for: Obstetrics
            </td>
          </tr>
          <tr><td height="10" colspan="2"><!-- --></td></tr>
        </table>
      ]]></description>
      <link>https://kill-the-newsletter.com/entries/test</link>
      <guid>test-item-1</guid>
      <pubDate>Thu, 22 Aug 2025 07:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

class DebugRSSServer {
  constructor() {
    this.server = null;
    this.port = 3002;
  }

  start() {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        if (req.url === '/real-structure.xml') {
          res.writeHead(200, { 
            'Content-Type': 'application/xml',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(realEmailStructure);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.listen(this.port, () => {
        log(`📡 Debug RSS server started on http://localhost:${this.port}/real-structure.xml`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      log('🛑 Debug RSS server stopped');
    }
  }

  getUrl() {
    return `http://localhost:${this.port}/real-structure.xml`;
  }
}

async function debugParser() {
  log('🔍 Debugging RSS Parser with Real Email Structure...');
  
  const server = new DebugRSSServer();
  
  try {
    // Start debug server
    await server.start();
    
    // Test RSS fetcher
    const fetcher = new RSSFetcher(server.getUrl());
    
    // Get feed info
    log('Getting RSS feed information...');
    const feedInfo = await fetcher.getFeedInfo();
    log(`📬 Feed: "${feedInfo.title}" with ${feedInfo.itemCount} items`);
    
    // Fetch articles
    log('Fetching articles from RSS feed...');
    const articles = await fetcher.fetchLatestEvidenceArticles();
    
    log(`🎯 Found ${articles.length} articles:`);
    articles.forEach((article, index) => {
      log(`   ${index + 1}. ${article.title}`);
      log(`      📖 Journal: ${article.journal}`);
      log(`      ⭐ Score: ${article.score}`);
      log(`      🏷️  Tags: ${article.tags.join(', ')}`);
      log(`      🔗 URL: ${article.evidenceAlertsUrl}`);
      log('');
    });
    
    // Also test direct HTML parsing
    log('🔬 Testing direct HTML parsing...');
    const htmlContent = realEmailStructure.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s)[1];
    log('Extracted HTML content from RSS CDATA');
    
    const directArticles = extractArticlesFromHtml(htmlContent);
    log(`🎯 Direct HTML parsing found ${directArticles.length} articles:`);
    directArticles.forEach((article, index) => {
      log(`   ${index + 1}. ${article.title}`);
      log(`      📖 Journal: ${article.journal}`);
      log(`      ⭐ Score: ${article.score}`);
      log(`      🏷️  Tags: ${article.tags.join(', ')}`);
      log(`      🔗 URL: ${article.evidenceAlertsUrl}`);
      log('');
    });
    
  } catch (error) {
    log(`❌ Debug failed: ${error.message}`, 'error');
    console.error(error.stack);
  } finally {
    server.stop();
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugParser();
}

export { debugParser };