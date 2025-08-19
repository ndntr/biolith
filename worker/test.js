// Basic test script for news aggregation system
const { FEED_SOURCES, getFeedsBySection } = require('./src/feeds');

console.log('Testing News Aggregation System');
console.log('================================\n');

// Test feed sources configuration
console.log('1. Testing feed sources:');
console.log(`Total feeds configured: ${FEED_SOURCES.length}`);

const sections = ['global', 'australia', 'technology', 'medical'];
sections.forEach(section => {
    const feeds = getFeedsBySection(section);
    console.log(`${section}: ${feeds.length} feeds`);
    feeds.forEach(feed => {
        console.log(`  - ${feed.name}: ${feed.url}`);
    });
});

console.log('\n2. Testing medical subsections:');
const medicalSubsections = ['clinical', 'professional', 'patient_signals'];
medicalSubsections.forEach(subsection => {
    const feeds = getFeedsBySection('medical', subsection);
    console.log(`medical.${subsection}: ${feeds.length} feeds`);
    feeds.forEach(feed => {
        console.log(`  - ${feed.name}: ${feed.url}`);
    });
});

console.log('\n3. Testing normalization functions:');
const { normalizeText, extractShingles, jaccardSimilarity } = require('./src/normalize');

const text1 = "Breaking: Apple Releases New iPhone with Amazing Features!";
const text2 = "Apple unveils latest iPhone model with new capabilities";

console.log(`Original 1: "${text1}"`);
console.log(`Normalized 1: "${normalizeText(text1)}"`);
console.log(`Original 2: "${text2}"`);
console.log(`Normalized 2: "${normalizeText(text2)}"`);

const shingles1 = extractShingles(text1, 3);
const shingles2 = extractShingles(text2, 3);
const similarity = jaccardSimilarity(shingles1, shingles2);

console.log(`Jaccard similarity: ${similarity.toFixed(3)}`);

console.log('\n4. Testing clustering:');
const { clusterNewsItems } = require('./src/cluster');

const testItems = [
    {
        source: 'NYTimes',
        url: 'https://nytimes.com/article1',
        published_at: new Date().toISOString(),
        title: 'Apple Announces New iPhone 16 with AI Features',
        standfirst: 'The tech giant reveals its latest smartphone...'
    },
    {
        source: 'TechCrunch',
        url: 'https://techcrunch.com/article2',
        published_at: new Date().toISOString(),
        title: 'Apple Unveils iPhone 16 with Advanced AI Capabilities',
        standfirst: 'Apple has announced the iPhone 16...'
    },
    {
        source: 'BBC',
        url: 'https://bbc.com/article3',
        published_at: new Date().toISOString(),
        title: 'Climate Change Report Shows Rising Temperatures',
        standfirst: 'Scientists warn of accelerating climate change...'
    }
];

const clusters = clusterNewsItems(testItems, 0.5);
console.log(`Created ${clusters.length} clusters:`);
clusters.forEach((cluster, i) => {
    console.log(`Cluster ${i + 1}: "${cluster.title}" (${cluster.coverage} sources)`);
    cluster.items.forEach(item => {
        console.log(`  - ${item.source}: ${item.title}`);
    });
});

console.log('\nTest completed successfully! ✅');
console.log('\nNext steps:');
console.log('1. Run: cd news-worker && npm install');
console.log('2. Set up Cloudflare KV namespaces');
console.log('3. Update wrangler.toml with your KV IDs and tokens');
console.log('4. Deploy: npx wrangler deploy');
console.log('5. Set up routing in Cloudflare dashboard');
console.log('6. Test the endpoints');