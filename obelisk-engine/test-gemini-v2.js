const { generateBatchAISummaries } = require('./dist/normalize');
const { geminiQuotaTracker } = require('./dist/quota-tracker');

// Create realistic mock clusters
function createMockClusters(count) {
  const clusters = [];
  const topics = [
    { title: 'Government announces new climate policy', content: 'Major climate initiatives unveiled today with targets for carbon reduction.' },
    { title: 'Technology companies report earnings', content: 'Tech giants exceed expectations in quarterly results.' },
    { title: 'Medical breakthrough in cancer research', content: 'Scientists discover promising new treatment approach.' },
    { title: 'International trade agreement signed', content: 'Multiple nations agree to new trade framework.' },
    { title: 'Space exploration milestone achieved', content: 'Historic mission successfully reaches destination.' }
  ];
  
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    clusters.push({
      items: [
        {
          title: `${topic.title} - Source A`,
          content: topic.content,
          standfirst: `Breaking: ${topic.content}`,
          source: 'News Network A',
          url: `https://example.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        },
        {
          title: `${topic.title} - Source B perspective`,
          content: `Another angle: ${topic.content}`,
          standfirst: `Analysis: ${topic.content}`,
          source: 'News Network B',
          url: `https://example2.com/article-${i + 1}`,
          published_at: new Date().toISOString()
        }
      ],
      coverage: 2,
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
  
  console.log('=====================================');
  console.log('Gemini 2.0 Flash-Lite API Test');
  console.log('Configuration:');
  console.log('  - Model: gemini-2.0-flash-lite');
  console.log('  - Rate limits: 30 RPM, 200 RPD');
  console.log('  - Chunk size: 15 clusters');
  console.log('  - Concurrency: 3 requests');
  console.log('=====================================\n');
  
  // Check quota status first
  const quotaStatus = await geminiQuotaTracker.getStatus();
  console.log(`Current quota: ${quotaStatus.used}/${quotaStatus.total} used, ${quotaStatus.remaining} remaining`);
  console.log(`Resets at: ${new Date(quotaStatus.resetsAt).toLocaleString()}\n`);
  
  // Test with typical news load (simulating ~60 clusters)
  const testSize = 30; // Start smaller to ensure success
  console.log(`Testing with ${testSize} clusters (typical for 1-2 news sections)...`);
  
  const clusters = createMockClusters(testSize);
  const startTime = Date.now();
  
  try {
    await generateBatchAISummaries(clusters, { GEMINI_API_KEY });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Check results
    const withHeadlines = clusters.filter(c => c.neutral_headline).length;
    const withSummaries = clusters.filter(c => c.ai_summary).length;
    
    console.log(`\n✅ SUCCESS!`);
    console.log(`  Duration: ${duration.toFixed(1)}s`);
    console.log(`  Headlines generated: ${withHeadlines}/${testSize}`);
    console.log(`  Summaries generated: ${withSummaries}/${testSize}`);
    console.log(`  Success rate: ${((withHeadlines/testSize) * 100).toFixed(0)}%`);
    
    // Show sample results
    if (withHeadlines > 0) {
      console.log(`\n📰 Sample Results:`);
      const samples = clusters.filter(c => c.neutral_headline).slice(0, 3);
      samples.forEach((sample, i) => {
        console.log(`\n  [${i + 1}] Original: "${sample.items[0].title}"`);
        console.log(`      AI Headline: "${sample.neutral_headline}"`);
        if (sample.ai_summary) {
          const bullets = sample.ai_summary.split('\n').slice(0, 2);
          console.log(`      Summary preview:`);
          bullets.forEach(b => console.log(`        ${b}`));
        }
      });
    }
    
    // Check final quota
    const finalQuota = await geminiQuotaTracker.getStatus();
    console.log(`\n📊 Quota used: ${finalQuota.used - quotaStatus.used} requests`);
    console.log(`   Remaining today: ${finalQuota.remaining}/${finalQuota.total}`);
    
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    if (error.status) {
      console.error(`   HTTP Status: ${error.status}`);
    }
  }
  
  console.log('\n=====================================');
  console.log('Test completed!');
  console.log('=====================================');
}

runTest().catch(console.error);