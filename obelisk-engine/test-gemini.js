const { generateBatchAISummaries } = require('./dist/normalize');

// Create mock clusters for testing
function createMockClusters(count) {
  const clusters = [];
  
  for (let i = 0; i < count; i++) {
    clusters.push({
      items: [
        {
          title: `Breaking News ${i + 1}: Major Technology Breakthrough Announced by Leading Tech Companies`,
          content: `In a significant development today, major technology companies have announced groundbreaking innovations that could reshape the industry. The announcement comes after months of speculation about new products and services.`,
          standfirst: `Technology giants reveal new innovations in artificial intelligence and quantum computing, promising to revolutionize how we interact with technology.`,
          source: 'Tech News Daily',
          url: `https://example.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        },
        {
          title: `Silicon Valley Giants Unveil Revolutionary Tech at Annual Conference`,
          content: `Multiple technology firms showcased their latest innovations at today's conference, with demonstrations of advanced AI systems and next-generation computing platforms.`,
          standfirst: `Industry leaders demonstrate cutting-edge technology that experts say will define the next decade of innovation.`,
          source: 'Innovation Weekly',
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

async function runTest() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set');
    console.log('Please set it with: export GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }
  
  console.log('Starting Gemini API test with chunked processing...');
  console.log('================================================\n');
  
  // Test with a realistic number of clusters (simulating your typical load)
  const testSizes = [24, 48, 72];
  
  for (const size of testSizes) {
    console.log(`Testing with ${size} clusters (simulating ${size/24} news sections)...`);
    const clusters = createMockClusters(size);
    
    const startTime = Date.now();
    
    try {
      await generateBatchAISummaries(clusters, { GEMINI_API_KEY });
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      // Check results
      const withHeadlines = clusters.filter(c => c.neutral_headline).length;
      const withSummaries = clusters.filter(c => c.ai_summary).length;
      
      console.log(`✓ Completed in ${duration.toFixed(1)}s`);
      console.log(`  Headlines generated: ${withHeadlines}/${size}`);
      console.log(`  Summaries generated: ${withSummaries}/${size}`);
      
      // Show sample results
      if (withHeadlines > 0) {
        const sample = clusters.find(c => c.neutral_headline);
        console.log(`  Sample headline: "${sample.neutral_headline}"`);
        if (sample.ai_summary) {
          const firstBullet = sample.ai_summary.split('\n')[0];
          console.log(`  Sample bullet: "${firstBullet}"`);
        }
      }
      
    } catch (error) {
      console.error(`✗ Failed with ${size} clusters:`, error.message);
      if (error.status) {
        console.error(`  HTTP Status: ${error.status}`);
      }
    }
    
    console.log('');
  }
  
  console.log('================================================');
  console.log('Test completed!');
}

runTest().catch(console.error);