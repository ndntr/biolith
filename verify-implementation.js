#!/usr/bin/env node

// Simple verification script for the evidence summary implementation
import fs from 'fs';

console.log('🔍 Verifying Evidence Summary Implementation');
console.log('='.repeat(50));

// Test 1: Check evidence data contains summaries
console.log('\n1. Testing Evidence Data:');
try {
  const data = JSON.parse(fs.readFileSync('./saltpile-engine/data/evidence.json', 'utf-8'));
  const articlesWithSummaries = data.articles.filter(article => article.summary);
  
  console.log(`✓ Evidence data loaded successfully`);
  console.log(`✓ Found ${articlesWithSummaries.length} articles with summaries out of ${data.articles.length} total`);
  
  if (articlesWithSummaries.length > 0) {
    console.log(`✓ Sample summary: "${articlesWithSummaries[0].summary}"`);
  } else {
    console.log('✗ No articles with summaries found');
  }
} catch (error) {
  console.log(`✗ Failed to load evidence data: ${error.message}`);
}

// Test 2: Check JavaScript modal function has been updated
console.log('\n2. Testing JavaScript Code:');
try {
  const jsContent = fs.readFileSync('./scripts/js/news-new.js', 'utf-8');
  
  if (jsContent.includes('evidence-summary')) {
    console.log('✓ Found evidence-summary class in JavaScript');
  } else {
    console.log('✗ evidence-summary class not found in JavaScript');
  }
  
  if (jsContent.includes('article.summary')) {
    console.log('✓ Found article.summary usage in JavaScript');
  } else {
    console.log('✗ article.summary usage not found in JavaScript');
  }
  
  if (jsContent.includes('Summary</h3>')) {
    console.log('✓ Found Summary section header in JavaScript');
  } else {
    console.log('✗ Summary section header not found in JavaScript');
  }
} catch (error) {
  console.log(`✗ Failed to read JavaScript file: ${error.message}`);
}

// Test 3: Check CSS styles exist
console.log('\n3. Testing CSS Styles:');
try {
  const cssContent = fs.readFileSync('./style.css', 'utf-8');
  
  if (cssContent.includes('.evidence-summary')) {
    console.log('✓ Found .evidence-summary CSS rule');
  } else {
    console.log('✗ .evidence-summary CSS rule not found');
  }
  
  if (cssContent.includes('rgba(0, 119, 255, 0.08)')) {
    console.log('✓ Found blue background styling');
  } else {
    console.log('✗ Blue background styling not found');
  }
  
  if (cssContent.includes('border-left: 4px solid #0077ff')) {
    console.log('✓ Found blue border styling');
  } else {
    console.log('✗ Blue border styling not found');
  }
} catch (error) {
  console.log(`✗ Failed to read CSS file: ${error.message}`);
}

// Test 4: Check TypeScript types have been updated
console.log('\n4. Testing TypeScript Types:');
try {
  const typesContent = fs.readFileSync('./saltpile-engine/src/types.ts', 'utf-8');
  
  if (typesContent.includes('summary?: string')) {
    console.log('✓ Found summary field in EvidenceArticle interface');
  } else {
    console.log('✗ summary field not found in EvidenceArticle interface');
  }
  
  if (typesContent.includes('AI-generated one-sentence summary')) {
    console.log('✓ Found summary field comment');
  } else {
    console.log('✗ Summary field comment not found');
  }
} catch (error) {
  console.log(`✗ Failed to read TypeScript types: ${error.message}`);
}

// Test 5: Check AI summarizer exists
console.log('\n5. Testing AI Summarizer:');
try {
  const summarizerContent = fs.readFileSync('./saltpile-engine/src/ai-summarizer.ts', 'utf-8');
  
  if (summarizerContent.includes('generateEvidenceSummary')) {
    console.log('✓ Found generateEvidenceSummary function');
  } else {
    console.log('✗ generateEvidenceSummary function not found');
  }
  
  if (summarizerContent.includes('Can I get a 1 sentence plain language')) {
    console.log('✓ Found correct prompt text');
  } else {
    console.log('✗ Correct prompt text not found');
  }
} catch (error) {
  console.log(`✗ Failed to read AI summarizer: ${error.message}`);
}

console.log('\n' + '='.repeat(50));
console.log('🎯 Implementation Status: Ready for Manual Testing');
console.log('\nTo test the UI:');
console.log('1. Open http://localhost:8080 in your browser');
console.log('2. Navigate to the Medical tab');
console.log('3. Click on any evidence article');
console.log('4. Look for a blue Summary section above the Abstract');
console.log('\nThe server should be running on localhost:8080');