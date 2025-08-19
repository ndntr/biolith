#!/usr/bin/env node

/**
 * Diagnostic tool to analyze AI processing chunks and responses
 */

require('dotenv').config();
const fs = require('fs').promises;

// Mock the AI processing to see chunk distribution
function analyzeChunkDistribution() {
    console.log('🔍 Analyzing Chunk Distribution\n');
    
    // Simulate the cluster counts from actual data
    const sections = [
        { name: 'global', count: 19 },
        { name: 'australia', count: 35 },
        { name: 'technology', count: 10 }
    ];
    
    const CHUNK_SIZE = 15;
    let totalClusters = 0;
    let clusterIndex = 0;
    let chunks = [];
    
    // Build cluster list with section info
    const allClusters = [];
    sections.forEach(section => {
        for (let i = 0; i < section.count; i++) {
            allClusters.push({
                section: section.name,
                localIndex: i,
                globalIndex: totalClusters++,
                id: `cluster_${i}`
            });
        }
    });
    
    // Split into chunks
    for (let i = 0; i < allClusters.length; i += CHUNK_SIZE) {
        const chunk = allClusters.slice(i, i + CHUNK_SIZE);
        chunks.push({
            chunkIndex: Math.floor(i / CHUNK_SIZE),
            clusters: chunk,
            size: chunk.length
        });
    }
    
    // Analyze each chunk
    chunks.forEach((chunk, index) => {
        console.log(`📦 CHUNK ${index + 1}/${chunks.length} (${chunk.size} clusters):`);
        
        // Group by section
        const bySections = {};
        chunk.clusters.forEach(cluster => {
            if (!bySections[cluster.section]) {
                bySections[cluster.section] = [];
            }
            bySections[cluster.section].push(cluster);
        });
        
        Object.keys(bySections).forEach(section => {
            const clusters = bySections[section];
            const indices = clusters.map(c => c.localIndex);
            console.log(`   ${section}: ${clusters.length} clusters (indices ${Math.min(...indices)}-${Math.max(...indices)})`);
        });
        console.log('');
    });
    
    // Check which chunk contains the problematic Technology stories
    console.log('🎯 Technology Story Distribution:');
    const technologyChunks = chunks.filter(chunk => 
        chunk.clusters.some(c => c.section === 'technology')
    );
    
    technologyChunks.forEach(chunk => {
        const techClusters = chunk.clusters.filter(c => c.section === 'technology');
        console.log(`   Chunk ${chunk.chunkIndex + 1}: Technology clusters ${techClusters.map(c => c.localIndex).join(', ')}`);
        
        if (techClusters.some(c => c.localIndex === 0)) console.log('     ↳ Contains story #1 (has bullets) ✅');
        if (techClusters.some(c => c.localIndex === 1)) console.log('     ↳ Contains story #2 (partial "No") ⚠️');
        if (techClusters.some(c => c.localIndex >= 2)) console.log('     ↳ Contains stories #3+ (no bullets) ❌');
    });
}

// Test actual API call to see response structure
async function testActualAPICall() {
    console.log('\n🧪 Testing Actual Gemini API Call\n');
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('❌ No GEMINI_API_KEY found');
        return;
    }
    
    // Create a small test with 2 clusters to see the exact response format
    const testPrompt = `Process 2 news clusters. For each cluster, generate:
1. A neutral headline (max 12 words, no period, no contractions)
2. A 5-bullet summary (max 26 words per bullet)

Format your response as:
CLUSTER 1:
HEADLINE: [headline here]
SUMMARY:
- [bullet 1]
- [bullet 2]
- [bullet 3]
- [bullet 4]
- [bullet 5]

CLUSTER 2:
[repeat format]

Requirements:
- Always generate exactly 5 bullets per cluster
- Be concise and factual

## CLUSTER 1:
[Test Source] Test headline: Test content for first cluster to analyze response format.

## CLUSTER 2:
[Test Source] Second headline: Test content for second cluster to verify complete processing.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: testPrompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                    topP: 0.8,
                    topK: 10
                }
            })
        });
        
        if (!response.ok) {
            console.log(`❌ API Error: ${response.status}`);
            return;
        }
        
        const result = await response.json();
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        console.log('📝 Raw API Response:');
        console.log('─'.repeat(50));
        console.log(responseText);
        console.log('─'.repeat(50));
        console.log(`Response length: ${responseText.length} characters\n`);
        
        // Analyze the parsing
        console.log('🔍 Parsing Analysis:');
        const clusterBlocks = responseText.split(/CLUSTER \d+:/i).slice(1);
        console.log(`Found ${clusterBlocks.length} cluster blocks`);
        
        clusterBlocks.forEach((block, index) => {
            console.log(`\nCluster ${index + 1}:`);
            
            const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|SUMMARY:|$)/i);
            console.log(`  Headline: ${headlineMatch ? '✅ Found' : '❌ Missing'}`);
            
            const summaryMatch = block.match(/SUMMARY:\s*((?:\s*-.*(?:\n|$))+)/i);
            if (summaryMatch) {
                const bullets = summaryMatch[1]
                    .split(/\n/)
                    .map(line => line.trim())
                    .filter(line => line.startsWith('-'))
                    .map(line => line.replace(/^-\s*/, '').trim())
                    .filter(line => line.length > 0);
                
                console.log(`  Bullets: ${bullets.length}/5 found`);
                bullets.forEach((bullet, i) => {
                    console.log(`    ${i + 1}. ${bullet.length > 50 ? bullet.substring(0, 50) + '...' : bullet}`);
                });
            } else {
                console.log(`  Bullets: ❌ No summary section found`);
            }
        });
        
    } catch (error) {
        console.error('❌ API Test failed:', error.message);
    }
}

async function main() {
    analyzeChunkDistribution();
    await testActualAPICall();
}

main().catch(console.error);