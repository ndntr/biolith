#!/usr/bin/env node

/**
 * Local Testing Environment for News Processor
 * Runs the full pipeline locally with real RSS feeds and Gemini API
 */

require('dotenv').config();

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(50)}`, colors.blue);
  log(title, colors.bright + colors.blue);
  log(`${'='.repeat(50)}`, colors.blue);
  console.log('');
}

async function checkEnvironment() {
  logSection('🔍 Checking Environment');
  
  // Check Node version
  const nodeVersion = process.version;
  log(`✓ Node.js version: ${nodeVersion}`, colors.green);
  
  // Check for Gemini API key
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  if (hasApiKey) {
    log(`✓ GEMINI_API_KEY is set`, colors.green);
  } else {
    log(`✗ GEMINI_API_KEY is not set`, colors.red);
    log(`  Set it with: export GEMINI_API_KEY=your_key_here`, colors.yellow);
    return false;
  }
  
  // Check if TypeScript is compiled
  try {
    await fs.access('dist');
    log(`✓ TypeScript compiled (dist/ exists)`, colors.green);
  } catch {
    log(`⚠ TypeScript not compiled, building now...`, colors.yellow);
    await runCommand('npm run build');
  }
  
  return true;
}

async function runCommand(command, showOutput = true) {
  return new Promise((resolve, reject) => {
    const proc = exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    if (showOutput) {
      proc.stdout.on('data', (data) => process.stdout.write(data));
      proc.stderr.on('data', (data) => process.stderr.write(data));
    }
  });
}

async function processNews() {
  logSection('📰 Processing News Feeds');
  
  const startTime = Date.now();
  
  try {
    // Run the main processor
    log('Fetching RSS feeds and processing articles...', colors.cyan);
    await runCommand('node dist/github-processor.js');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ Processing completed in ${duration}s`, colors.green);
    
    // Check output files
    const files = ['global.json', 'australia.json', 'technology.json', 'medical.json'];
    for (const file of files) {
      const filePath = path.join('data', file);
      try {
        const stats = await fs.stat(filePath);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        const clusterCount = file === 'medical.json' 
          ? (data.clinical?.clusters?.length || 0) + 
            (data.professional?.clusters?.length || 0) + 
            (data.patient_signals?.clusters?.length || 0)
          : data.clusters?.length || 0;
        
        log(`  ✓ ${file}: ${clusterCount} clusters, ${(stats.size / 1024).toFixed(1)}KB`, colors.green);
      } catch (error) {
        log(`  ✗ ${file}: Failed to read`, colors.red);
      }
    }
    
    return true;
  } catch (error) {
    log(`✗ Processing failed: ${error.message}`, colors.red);
    return false;
  }
}

async function startLocalServers() {
  logSection('🚀 Starting Local Servers');
  
  log('Starting services:', colors.cyan);
  log('  1. Python HTTP server for news.html (port 8080)', colors.cyan);
  log('  2. Cloudflare Worker for API (port 8787)', colors.cyan);
  console.log('');
  
  // Start Python server for frontend
  log('Starting frontend server...', colors.yellow);
  const pythonServer = exec('python3 -m http.server 8080', { cwd: process.cwd() });
  
  pythonServer.stdout.on('data', (data) => {
    log(`[Frontend] ${data.trim()}`, colors.green);
  });
  
  pythonServer.stderr.on('data', (data) => {
    if (data.includes('Serving HTTP')) {
      log(`✓ Frontend server running at http://localhost:8080/news.html`, colors.green);
    }
  });
  
  // Start Wrangler for API
  setTimeout(async () => {
    log('Starting API server...', colors.yellow);
    const wranglerServer = exec('npx wrangler dev', { cwd: path.join(process.cwd(), 'news-worker') });
    
    wranglerServer.stdout.on('data', (data) => {
      if (data.includes('Ready on')) {
        log(`✓ API server running at http://localhost:8787`, colors.green);
        console.log('');
        log(`${'='.repeat(50)}`, colors.bright + colors.green);
        log('🎉 Local environment ready!', colors.bright + colors.green);
        log('📰 Open: http://localhost:8080/news.html', colors.bright + colors.green);
        log(`${'='.repeat(50)}`, colors.bright + colors.green);
        console.log('');
        log('Press Ctrl+C to stop all servers', colors.yellow);
      } else if (!data.includes('[mf:')) {
        log(`[API] ${data.trim()}`, colors.blue);
      }
    });
    
    wranglerServer.stderr.on('data', (data) => {
      if (!data.includes('⎔') && !data.includes('▲')) {
        log(`[API Error] ${data.trim()}`, colors.red);
      }
    });
  }, 2000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    log('\n\nShutting down servers...', colors.yellow);
    process.exit(0);
  });
}

async function showQuotaStatus() {
  logSection('📊 Gemini API Quota Status');
  
  try {
    const { geminiQuotaTracker } = require('./dist/quota-tracker');
    const status = await geminiQuotaTracker.getStatus();
    
    log(`Daily Quota: ${status.used}/${status.total} requests used`, colors.cyan);
    log(`Remaining: ${status.remaining} requests`, colors.cyan);
    log(`Resets at: ${new Date(status.resetsAt).toLocaleString()}`, colors.cyan);
    
    if (status.remaining < 50) {
      log(`⚠ Warning: Low quota remaining!`, colors.yellow);
    }
  } catch (error) {
    log('No quota data available yet', colors.yellow);
  }
}

async function main() {
  console.clear();
  log(`
╔═══════════════════════════════════════════════════╗
║     📰 News Processor - Local Test Environment    ║
╚═══════════════════════════════════════════════════╝
`, colors.bright + colors.cyan);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'process') {
    // Just process news without starting servers
    const ready = await checkEnvironment();
    if (!ready) {
      log('\n❌ Environment check failed', colors.red);
      process.exit(1);
    }
    
    await showQuotaStatus();
    await processNews();
    
  } else if (command === 'serve') {
    // Just start servers without processing
    await startLocalServers();
    
  } else if (command === 'quota') {
    // Show quota status
    await showQuotaStatus();
    
  } else {
    // Default: process then serve
    const ready = await checkEnvironment();
    if (!ready) {
      log('\n❌ Environment check failed', colors.red);
      process.exit(1);
    }
    
    await showQuotaStatus();
    const success = await processNews();
    
    if (success) {
      await startLocalServers();
    } else {
      log('\n⚠ Processing had issues, but starting servers anyway...', colors.yellow);
      await startLocalServers();
    }
  }
}

// Run the test environment
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});