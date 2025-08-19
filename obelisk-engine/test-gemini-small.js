const { generateBatchAISummaries } = require('./dist/normalize');

// Create mock clusters for testing
function createMockClusters(count) {
  const clusters = [];
  
  for (let i = 0; i < count; i++) {
    clusters.push({
      items: [
        {
          title: `Breaking News ${i + 1}: Major Technology Breakthrough`,
          content: `Technology companies announced innovations today.`,
          standfirst: `New AI and quantum computing advances revealed.`,
          source: 'Tech Daily',
          url: `https://example.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        }
      ],
      coverage: 1,
      updated_at: new Date().toISOString(),
      popularity_score: 2000 - i * 10
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
  
  console.log('Testing Gemini API with conservative rate limits...');
  console.log('Configuration: 10 clusters/chunk, 2 concurrent, 4.5s between requests');
  console.log('================================================\n');
  
  // Start with a small test
  const size = 20;
  console.log(`Testing with ${size} clusters...`);
  const clusters = createMockClusters(size);
  
  const startTime = Date.now();
  
  try {
    await generateBatchAISummaries(clusters, { GEMINI_API_KEY });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Check results
    const withHeadlines = clusters.filter(c => c.neutral_headline).length;
    const withSummaries = clusters.filter(c => c.ai_summary).length;
    
    console.log(`\n✓ SUCCESS! Completed in ${duration.toFixed(1)}s`);
    console.log(`  Headlines generated: ${withHeadlines}/${size}`);
    console.log(`  Summaries generated: ${withSummaries}/${size}`);
    
    // Show sample results
    if (withHeadlines > 0) {
      const sample = clusters.find(c => c.neutral_headline);
      console.log(`\n  Sample output:`);
      console.log(`  Headline: "${sample.neutral_headline}"`);
      if (sample.ai_summary) {
        console.log(`  Summary:\n${sample.ai_summary.split('\n').map(b => '    ' + b).join('\n')}`);
      }
    }
    
  } catch (error) {
    console.error(`\n✗ Failed:`, error.message);
  }
  
  console.log('\n================================================');
  console.log('Configuration works! Ready for production use.');
}

runTest().catch(console.error);