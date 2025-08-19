#!/usr/bin/env node

/**
 * Full Pipeline Test - Tests the complete news processing workflow
 * This script validates each step of the pipeline and measures performance
 */

const { exec } = require('child_process');
const { promises as fs } = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  sections: ['global', 'australia', 'technology', 'medical'],
  expectedFiles: ['global.json', 'australia.json', 'technology.json', 'medical.json'],
  minClustersPerSection: {
    global: 10,
    australia: 5,
    technology: 5,
    medical: 3
  }
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, status = 'info') {
  const statusColors = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red
  };
  const statusSymbols = {
    info: '🔵',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  log(`${statusSymbols[status]} ${step}`, statusColors[status]);
}

async function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function testEnvironment() {
  logStep('Testing Environment Setup');
  
  const checks = [];
  
  // Check Node.js
  const nodeVersion = process.version;
  checks.push({ name: 'Node.js', value: nodeVersion, status: 'success' });
  
  // Check Gemini API key
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  checks.push({ 
    name: 'GEMINI_API_KEY', 
    value: hasApiKey ? 'Set' : 'Missing', 
    status: hasApiKey ? 'success' : 'error' 
  });
  
  // Check TypeScript compilation
  try {
    await fs.access('dist');
    checks.push({ name: 'TypeScript Build', value: 'Available', status: 'success' });
  } catch {
    checks.push({ name: 'TypeScript Build', value: 'Missing', status: 'warning' });
  }
  
  // Check data directory
  try {
    await fs.access('data');
    checks.push({ name: 'Data Directory', value: 'Exists', status: 'success' });
  } catch {
    await fs.mkdir('data', { recursive: true });
    checks.push({ name: 'Data Directory', value: 'Created', status: 'success' });
  }
  
  // Print results
  console.log('');
  checks.forEach(check => {
    const symbol = check.status === 'success' ? '✅' : 
                   check.status === 'warning' ? '⚠️' : '❌';
    log(`  ${symbol} ${check.name}: ${check.value}`);
  });
  
  const hasErrors = checks.some(c => c.status === 'error');
  return !hasErrors;
}

async function testBuild() {
  logStep('Building TypeScript');
  
  try {
    const result = await runCommand('npm run build');
    logStep('TypeScript build completed', 'success');
    return true;
  } catch (error) {
    logStep(`Build failed: ${error.message}`, 'error');
    return false;
  }
}

async function testQuotaTracker() {
  logStep('Testing Quota Tracker');
  
  try {
    const { geminiQuotaTracker } = require('./dist/quota-tracker');
    const status = await geminiQuotaTracker.getStatus();
    
    log(`  📊 Quota: ${status.used}/${status.total} used, ${status.remaining} remaining`);
    log(`  🕐 Resets: ${new Date(status.resetsAt).toLocaleString()}`);
    
    if (status.remaining < 10) {
      logStep('Low quota warning', 'warning');
    } else {
      logStep('Quota tracker working', 'success');
    }
    
    return true;
  } catch (error) {
    logStep(`Quota tracker failed: ${error.message}`, 'error');
    return false;
  }
}

async function testFeedFetching() {
  logStep('Testing RSS Feed Fetching');
  
  try {
    // Test a small subset first
    const { getFeedsBySection } = require('./dist/feeds');
    const { fetchAllFeeds } = require('./dist/fetcher');
    
    const globalFeeds = getFeedsBySection('global').slice(0, 3); // Test first 3 feeds
    log(`  📡 Testing ${globalFeeds.length} sample feeds...`);
    
    const startTime = Date.now();
    const items = await fetchAllFeeds(globalFeeds);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (items.length > 0) {
      logStep(`Fetched ${items.length} articles in ${duration}s`, 'success');
      log(`  📰 Sample article: "${items[0].title.substring(0, 60)}..."`);
      return true;
    } else {
      logStep('No articles fetched', 'warning');
      return false;
    }
  } catch (error) {
    logStep(`Feed fetching failed: ${error.message}`, 'error');
    return false;
  }
}

async function testClustering() {
  logStep('Testing Article Clustering');
  
  try {
    const { getFeedsBySection } = require('./dist/feeds');
    const { fetchAllFeeds } = require('./dist/fetcher');
    const { clusterNewsItems } = require('./dist/cluster');
    
    // Get a small sample
    const feeds = getFeedsBySection('global').slice(0, 2);
    const items = await fetchAllFeeds(feeds);
    
    if (items.length === 0) {
      logStep('No items to cluster', 'warning');
      return false;
    }
    
    const clusters = clusterNewsItems(items, 0.18);
    
    if (clusters.length > 0) {
      logStep(`Created ${clusters.length} clusters from ${items.length} articles`, 'success');
      log(`  🔗 Cluster coverage: ${clusters.map(c => c.coverage).join(', ')}`);
      return true;
    } else {
      logStep('No clusters created', 'warning');
      return false;
    }
  } catch (error) {
    logStep(`Clustering failed: ${error.message}`, 'error');
    return false;
  }
}

async function testGeminiAPI() {
  logStep('Testing Gemini API Integration');
  
  try {
    const { generateBatchAISummaries } = require('./dist/normalize');
    
    // Create a minimal test cluster
    const testCluster = {
      items: [{
        title: 'Test News Article for API Integration',
        content: 'This is a test article to verify Gemini API integration is working properly.',
        standfirst: 'Testing API connectivity and response parsing.',
        source: 'Test Source',
        url: 'https://example.com/test',
        published_at: new Date().toISOString()
      }],
      coverage: 1,
      updated_at: new Date().toISOString(),
      popularity_score: 1000
    };
    
    log('  🤖 Sending test request to Gemini API...');
    const startTime = Date.now();
    
    await generateBatchAISummaries([testCluster], { GEMINI_API_KEY: process.env.GEMINI_API_KEY });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (testCluster.neutral_headline || testCluster.ai_summary) {
      logStep(`Gemini API working (${duration}s)`, 'success');
      if (testCluster.neutral_headline) {
        log(`  📰 Generated headline: "${testCluster.neutral_headline}"`);
      }
      return true;
    } else {
      logStep('Gemini API not generating content', 'warning');
      return false;
    }
  } catch (error) {
    logStep(`Gemini API failed: ${error.message}`, 'error');
    return false;
  }
}

async function testFullPipeline() {
  logStep('Running Full Pipeline Test');
  
  try {
    log('  🔄 Processing all sections...');
    const startTime = Date.now();
    
    // Run the full processor
    await runCommand('node dist/github-processor.js');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logStep(`Pipeline completed in ${duration}s`, 'success');
    
    // Validate outputs
    let totalClusters = 0;
    let aiSuccessCount = 0;
    
    for (const fileName of TEST_CONFIG.expectedFiles) {
      const filePath = path.join('data', fileName);
      
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        const section = fileName.replace('.json', '');
        
        let clusters;
        if (section === 'medical') {
          clusters = [
            ...(data.clinical?.clusters || []),
            ...(data.professional?.clusters || []),
            ...(data.patient_signals?.clusters || [])
          ];
        } else {
          clusters = data.clusters || [];
        }
        
        totalClusters += clusters.length;
        
        // Count AI-enhanced clusters
        const withAI = clusters.filter(c => c.neutral_headline || c.ai_summary).length;
        aiSuccessCount += withAI;
        
        const minExpected = TEST_CONFIG.minClustersPerSection[section] || 1;
        const status = clusters.length >= minExpected ? 'success' : 'warning';
        
        logStep(`${section}: ${clusters.length} clusters, ${withAI} AI-enhanced`, status);
        
      } catch (error) {
        logStep(`${fileName}: Failed to read`, 'error');
      }
    }
    
    // Summary
    console.log('');
    log(`📊 Pipeline Summary:`, colors.bright + colors.cyan);
    log(`   Total clusters: ${totalClusters}`);
    log(`   AI-enhanced: ${aiSuccessCount} (${((aiSuccessCount/totalClusters)*100).toFixed(0)}%)`);
    log(`   Processing time: ${duration}s`);
    
    return totalClusters > 0;
    
  } catch (error) {
    logStep(`Full pipeline failed: ${error.message}`, 'error');
    return false;
  }
}

async function testLocalServers() {
  logStep('Testing Local Server Setup');
  
  // Check if Python is available
  try {
    await runCommand('python3 --version');
    logStep('Python HTTP server available', 'success');
  } catch {
    logStep('Python HTTP server not available', 'warning');
  }
  
  // Check if Wrangler is available
  try {
    await runCommand('npx wrangler --version');
    logStep('Wrangler available for API server', 'success');
  } catch {
    logStep('Wrangler not available', 'warning');
  }
  
  // Check if worker directory exists
  try {
    await fs.access('news-worker');
    logStep('Worker directory found', 'success');
    return true;
  } catch {
    logStep('Worker directory missing', 'error');
    return false;
  }
}

async function main() {
  console.clear();
  log(`
╔═══════════════════════════════════════════════════════════╗
║         📰 News Pipeline - Comprehensive Test Suite       ║
╚═══════════════════════════════════════════════════════════╝
`, colors.bright + colors.magenta);

  const tests = [
    { name: 'Environment', fn: testEnvironment },
    { name: 'Build', fn: testBuild },
    { name: 'Quota Tracker', fn: testQuotaTracker },
    { name: 'Feed Fetching', fn: testFeedFetching },
    { name: 'Clustering', fn: testClustering },
    { name: 'Gemini API', fn: testGeminiAPI },
    { name: 'Full Pipeline', fn: testFullPipeline },
    { name: 'Local Servers', fn: testLocalServers }
  ];
  
  const results = [];
  let currentTest = 1;
  
  for (const test of tests) {
    console.log('');
    log(`[${currentTest}/${tests.length}] ${test.name}`, colors.bright + colors.blue);
    log('─'.repeat(50), colors.blue);
    
    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result });
      
      if (result) {
        logStep(`${test.name} completed successfully`, 'success');
      } else {
        logStep(`${test.name} completed with warnings`, 'warning');
      }
    } catch (error) {
      results.push({ name: test.name, success: false, error: error.message });
      logStep(`${test.name} failed: ${error.message}`, 'error');
    }
    
    currentTest++;
  }
  
  // Final summary
  console.log('');
  log('═'.repeat(60), colors.bright + colors.magenta);
  log('📋 TEST SUMMARY', colors.bright + colors.magenta);
  log('═'.repeat(60), colors.bright + colors.magenta);
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const symbol = result.success ? '✅' : '❌';
    const color = result.success ? colors.green : colors.red;
    log(`${symbol} ${result.name}`, color);
    if (result.error) {
      log(`   └─ ${result.error}`, colors.red);
    }
  });
  
  console.log('');
  log(`Results: ${passed} passed, ${failed} failed`, 
      failed === 0 ? colors.green : colors.yellow);
  
  if (failed === 0) {
    console.log('');
    log('🎉 All tests passed! Your pipeline is ready.', colors.bright + colors.green);
    log('Run `npm run test:local` to start the development environment.', colors.cyan);
  } else {
    console.log('');
    log('⚠️  Some tests failed. Check the errors above.', colors.yellow);
  }
}

main().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});