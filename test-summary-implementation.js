// Test script to verify the evidence summary implementation
// Run this in the browser console on localhost:8080

console.log('=== Testing Evidence Summary Implementation ===');

// Test 1: Check if evidence data contains summaries
fetch('./saltpile-engine/data/evidence.json')
  .then(response => response.json())
  .then(data => {
    console.log('✓ Evidence data loaded');
    const articlesWithSummaries = data.articles.filter(article => article.summary);
    console.log(`Found ${articlesWithSummaries.length} articles with summaries out of ${data.articles.length} total articles`);
    
    if (articlesWithSummaries.length > 0) {
      console.log('Sample article with summary:', articlesWithSummaries[0].title);
      console.log('Summary:', articlesWithSummaries[0].summary);
    }
  })
  .catch(error => console.error('✗ Failed to load evidence data:', error));

// Test 2: Check if the JavaScript modal function has been updated
if (typeof openEvidenceModal === 'function') {
  console.log('✓ openEvidenceModal function exists');
  console.log('Function source preview:', openEvidenceModal.toString().substring(0, 500) + '...');
} else {
  console.log('✗ openEvidenceModal function not found');
}

// Test 3: Check if the CSS styles for evidence summary exist
const styleSheets = Array.from(document.styleSheets);
let summaryStyleFound = false;

styleSheets.forEach(sheet => {
  try {
    const rules = Array.from(sheet.cssRules || sheet.rules || []);
    rules.forEach(rule => {
      if (rule.selectorText && rule.selectorText.includes('.evidence-summary')) {
        console.log('✓ Found evidence-summary CSS rule:', rule.selectorText);
        summaryStyleFound = true;
      }
    });
  } catch (e) {
    // CORS issues with external stylesheets
  }
});

if (!summaryStyleFound) {
  console.log('⚠ evidence-summary CSS rule not found (might be in external stylesheet)');
}

console.log('=== Test Complete ===');
console.log('To manually test:');
console.log('1. Go to the Medical tab');
console.log('2. Click on the first evidence article (Ciprofloxacin vs Aminoglycoside...)');
console.log('3. Look for a blue highlighted "Summary" section above the Abstract');