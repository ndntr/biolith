#!/usr/bin/env node

/**
 * Debug script to inspect RSS content from Kill the Newsletter
 */

import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

const rssUrl = process.env.EVIDENCE_ALERTS_RSS_URL;

if (!rssUrl) {
  console.error('❌ EVIDENCE_ALERTS_RSS_URL environment variable is required');
  console.error('Please set it to your Kill the Newsletter RSS URL');
  process.exit(1);
}

async function debugRSS() {
  try {
    console.log('Fetching RSS feed...');
    const response = await fetch(rssUrl);
    
    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xmlContent = await response.text();
    console.log(`\n✅ Fetched RSS content (${xmlContent.length} characters)`);

    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: true
    });

    const parsedFeed = parser.parse(xmlContent);
    
    // Extract the actual content
    let items;
    if (parsedFeed.rss?.channel?.item) {
      items = parsedFeed.rss.channel.item;
    } else if (parsedFeed.channel?.item) {
      items = parsedFeed.channel.item;
    } else if (parsedFeed.feed?.entry) {
      items = parsedFeed.feed.entry;
    }

    if (!items) {
      console.log('❌ No items found in RSS feed');
      return;
    }

    const itemArray = Array.isArray(items) ? items : [items];
    console.log(`\n📋 Found ${itemArray.length} items in RSS feed`);

    // Process first item
    const firstItem = itemArray[0];
    const content = firstItem.description || firstItem.content || firstItem.summary || '';
    
    console.log('\n📄 First item details:');
    console.log('Title:', firstItem.title || 'No title');
    console.log('Content length:', content.length, 'characters');
    
    // Save content to file for inspection
    const debugFile = 'debug-rss-content.html';
    fs.writeFileSync(debugFile, content);
    console.log(`\n💾 Saved content to ${debugFile} for inspection`);
    
    // Check for patterns
    console.log('\n🔍 Pattern analysis:');
    console.log('Contains "Score:":', content.includes('Score:'));
    console.log('Contains "plus.mcmaster.ca":', content.includes('plus.mcmaster.ca'));
    console.log('Contains "Tagged for:":', content.includes('Tagged for:'));
    console.log('Contains "<table":', content.includes('<table'));
    console.log('Contains "<a href":', content.includes('<a href'));
    
    // Extract first 500 chars to see structure
    console.log('\n📝 First 500 characters of content:');
    console.log(content.substring(0, 500));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugRSS();