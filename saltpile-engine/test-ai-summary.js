#!/usr/bin/env node

// Test script to directly test AI summarization on existing articles
import fs from 'fs';
import { generateEvidenceSummary } from './dist/ai-summarizer.js';

async function testSummaryGeneration() {
  try {
    // Load existing evidence data
    const data = JSON.parse(fs.readFileSync('./data/evidence.json', 'utf-8'));
    
    console.log('🧪 Testing AI Summary Generation');
    console.log(`Found ${data.articles.length} articles in evidence.json`);
    
    // Test on the first article without a summary
    const testArticle = data.articles.find(article => !article.summary);
    
    if (!testArticle) {
      console.log('All articles already have summaries!');
      return;
    }
    
    console.log(`\n📄 Testing on article: "${testArticle.title.slice(0, 50)}..."`);
    console.log(`Journal: ${testArticle.journal}`);
    console.log(`Has abstract: ${!!testArticle.abstract}`);
    console.log(`Has structured abstract: ${!!testArticle.structuredAbstract}`);
    
    // Generate summary
    console.log('\n🤖 Generating AI summary...');
    const summary = await generateEvidenceSummary(testArticle);
    
    if (summary) {
      console.log('\n✅ Summary generated successfully:');
      console.log(`"${summary}"`);
      
      // Add summary to the article
      testArticle.summary = summary;
      
      // Save updated data
      data.updated_at = new Date().toISOString();
      fs.writeFileSync('./data/evidence.json', JSON.stringify(data, null, 2));
      console.log('\n💾 Updated evidence.json with new summary');
      
    } else {
      console.log('\n❌ Failed to generate summary');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSummaryGeneration();