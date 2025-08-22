#!/usr/bin/env node

/**
 * Script to update existing articles in evidence.json with structured abstracts
 */

import fs from 'fs';
import path from 'path';
import { PubMedFetcher } from '../dist/pubmed-fetcher.js';

async function updateArticles() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'evidence.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ evidence.json not found');
      return;
    }
    
    // Load existing data
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`📋 Found ${data.articles.length} articles`);
    
    const fetcher = new PubMedFetcher();
    let updated = 0;
    
    // Process each article
    for (const article of data.articles) {
      // Skip if already has structured abstract
      if (article.structuredAbstract) {
        console.log(`✓ ${article.title.substring(0, 50)}... already has structured abstract`);
        continue;
      }
      
      console.log(`🔄 Updating: ${article.title.substring(0, 50)}...`);
      
      try {
        const result = await fetcher.fetchArticleAbstract({
          title: article.title,
          journal: article.journal
        });
        
        if (result && result.structuredAbstract) {
          article.structuredAbstract = result.structuredAbstract;
          article.abstract = result.abstract || article.abstract;
          article.pubmedUrl = article.pubmedUrl || (result.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${result.pmid}/` : undefined);
          article.doi = article.doi || result.doi;
          article.pubDate = article.pubDate || result.pubDate;
          updated++;
          console.log(`  ✅ Added structured abstract with ${result.structuredAbstract.length} sections`);
        } else {
          console.log(`  ⚠️ No structured abstract available`);
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 350));
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`\n✅ Updated ${updated} articles with structured abstracts`);
    console.log(`💾 Saved to ${dataPath}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

updateArticles();