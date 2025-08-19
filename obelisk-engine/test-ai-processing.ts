import { generateBatchAISummaries } from './src/normalize';
import { NewsItem } from './src/types';

// Create mock clusters for testing
function createMockClusters(count: number): any[] {
  const clusters = [];
  
  for (let i = 0; i < count; i++) {
    clusters.push({
      items: [
        {
          title: `Test Article ${i + 1}: Major Development in Technology Sector`,
          content: `This is test content for article ${i + 1}. A significant development has occurred in the technology sector today as companies announce new initiatives.`,
          standfirst: `Summary of test article ${i + 1} discussing important technology developments.`,
          source: 'Test Source',
          url: `https://example.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        },
        {
          title: `Second Source Reports on Same Story ${i + 1}`,
          content: `Another perspective on the same story from a different news outlet.`,
          standfirst: `Different angle on the technology development story.`,
          source: 'Test Source 2',
          url: `https://example2.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        }
      ],
      coverage: 2,
      updated_at: new Date().toISOString(),
      popularity_score: 2000 + (count - i) * 10
    });
  }
  
  return clusters;
}

async function testAIProcessing() {
  // Check for Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
    console.log('Please set it with: export GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }
  
  console.log('Starting AI processing test...');
  console.log('-----------------------------------');
  
  // Test with different cluster sizes
  const testSizes = [15, 30, 60, 100];
  
  for (const size of testSizes) {
    console.log(`\nTesting with ${size} clusters...`);
    const clusters = createMockClusters(size);
    
    const startTime = Date.now();
    
    try {
      await generateBatchAISummaries(clusters, { GEMINI_API_KEY: process.env.GEMINI_API_KEY });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Check results
      const withHeadlines = clusters.filter(c => c.neutral_headline).length;
      const withSummaries = clusters.filter(c => c.ai_summary).length;
      
      console.log(`✓ Completed in ${duration.toFixed(1)}s`);
      console.log(`  - Headlines generated: ${withHeadlines}/${size}`);
      console.log(`  - Summaries generated: ${withSummaries}/${size}`);
      
      // Show a sample result
      if (withHeadlines > 0) {
        const sample = clusters.find(c => c.neutral_headline);
        console.log(`  - Sample headline: "${sample.neutral_headline}"`);
        if (sample.ai_summary) {
          console.log(`  - Sample summary (first line): "${sample.ai_summary.split('\n')[0]}"`);
        }
      }
      
    } catch (error) {
      console.error(`✗ Failed with ${size} clusters:`, error);
    }
  }
  
  console.log('\n-----------------------------------');
  console.log('Test completed!');
}

// Run the test
if (require.main === module) {
  testAIProcessing().catch(console.error);
}