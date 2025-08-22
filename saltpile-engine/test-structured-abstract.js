import { PubMedFetcher } from './dist/pubmed-fetcher.js';

async function testStructuredAbstract() {
  console.log('Testing PubMed structured abstract parsing...');
  
  const fetcher = new PubMedFetcher();
  
  // Test with a known article that should have a structured abstract
  const testParams = {
    title: 'Efficacy and Safety of Pharmacologic Therapies for Nausea and Emesis in the Emergency Department',
    journal: 'Ann Emerg Med',
    year: 2025
  };
  
  try {
    const result = await fetcher.fetchArticleAbstract(testParams);
    
    if (result) {
      console.log('✓ Article found');
      console.log('PMID:', result.pmid);
      console.log('Title:', result.title);
      console.log('Journal:', result.journal);
      
      if (result.structuredAbstract && result.structuredAbstract.length > 0) {
        console.log('✓ Structured abstract found with', result.structuredAbstract.length, 'sections:');
        
        result.structuredAbstract.forEach((section, index) => {
          console.log(`  ${index + 1}. ${section.label || '[No Label]'}: ${section.text.substring(0, 100)}...`);
        });
      } else {
        console.log('✗ No structured abstract found');
        console.log('Flat abstract (first 200 chars):', result.abstract ? result.abstract.substring(0, 200) + '...' : 'No abstract');
      }
      
      // Test publication info
      console.log('Publication Date:', result.pubDate || 'Not found');
      console.log('DOI:', result.doi || 'Not found');
    } else {
      console.log('✗ No article found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testStructuredAbstract();