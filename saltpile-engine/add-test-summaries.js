#!/usr/bin/env node

// Add test summaries to demonstrate the UI functionality
import fs from 'fs';

const testSummaries = [
  "Alteplase administered 4.5 to 24 hours after stroke onset improves functional outcomes despite increasing hemorrhage risk in patients with salvageable brain tissue.",
  "Intravenous tropisetron and prochlorperazine are most effective antiemetics for emergency department nausea, while metoclopramide and droperidol carry higher adverse reaction risks.",
  "Long-term aspirin use in healthy older adults shows no cardiovascular benefit and increases major bleeding risk over extended follow-up.",
  "GLP-1 receptor agonists reduce pulmonary embolism risk but do not significantly decrease overall venous thromboembolism risk in patients with diabetes or obesity.",
  "Stapokibart significantly reduces nasal polyp size and congestion severity in patients with chronic rhinosinusitis when added to intranasal corticosteroids.",
  "Carbetocin provides better uterine tone and requires fewer rescue treatments than oxytocin at cesarean delivery without increased cardiac risk."
];

function addTestSummaries() {
  try {
    // Load existing evidence data
    const data = JSON.parse(fs.readFileSync('./data/evidence.json', 'utf-8'));
    
    console.log('📝 Adding test summaries to evidence articles...');
    console.log(`Found ${data.articles.length} articles`);
    
    // Add summaries to articles that don't have them
    let summariesAdded = 0;
    let summaryIndex = 0;
    
    data.articles.forEach(article => {
      if (!article.summary && summaryIndex < testSummaries.length) {
        article.summary = testSummaries[summaryIndex];
        console.log(`✓ Added summary to: ${article.title.slice(0, 50)}...`);
        summariesAdded++;
        summaryIndex++;
      }
    });
    
    if (summariesAdded > 0) {
      // Save updated data
      data.updated_at = new Date().toISOString();
      fs.writeFileSync('./data/evidence.json', JSON.stringify(data, null, 2));
      console.log(`\n💾 Updated evidence.json with ${summariesAdded} new summaries`);
    } else {
      console.log('\n✅ All articles already have summaries');
    }
    
    console.log('\n🎯 Ready for UI testing!');
    console.log('You can now:');
    console.log('1. Open the website (localhost:8080)');
    console.log('2. Go to the Medical tab');
    console.log('3. Click any evidence article to see the summary above the abstract');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addTestSummaries();