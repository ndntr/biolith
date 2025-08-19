import { promises as fs } from 'fs';
import { getFeedsBySection } from './feeds';
import { fetchAllFeeds, fetchEvidenceAlerts } from './fetcher';
import { clusterNewsItems } from './cluster';
import { fetchScrapedPopularArticles } from './scraper';
import { generateBatchAISummaries } from './normalize';
import { SectionData, MedicalSectionData, NewsCluster } from './types';

// GitHub Actions environment - check for Gemini API key
const checkAI = () => {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    console.warn('Gemini API key not found, AI summaries will be disabled');
    return false;
  }

  return true;
};

async function processSection(section: string): Promise<SectionData> {
  console.log(`Processing section: ${section}`);
  
  const sources = getFeedsBySection(section);
  console.log(`Fetching ${sources.length} feeds for ${section}`);
  
  const items = await fetchAllFeeds(sources);
  console.log(`Retrieved ${items.length} items from feeds`);
  
  const clusters = clusterNewsItems(items, 0.18); // Optimal threshold
  console.log(`Created ${clusters.length} clusters`);

  // Define trusted sources that can show single-source stories
  const trustedSources = {
    'australia': ['ABC News Australia', 'ABC Just In', 'ABC News Australia (Popular)'],
    'technology': ['Ars Technica', 'Ars Technica Main']
  };

  // Filter clusters based on section rules
  let filteredClusters = clusters;
  if (['global', 'australia', 'technology'].includes(section)) {
    filteredClusters = clusters.filter(cluster => {
      // Always include multi-source clusters
      if (cluster.coverage >= 2) return true;
      
      // For single-source clusters, only include if from trusted sources
      if (section in trustedSources) {
        const trusted = trustedSources[section as keyof typeof trustedSources];
        return cluster.items.some(item => trusted.includes(item.source));
      }
      
      return false;
    });
  }

  // Only supplement with scraped articles if we have insufficient single-source trusted content
  if ((section === 'australia' || section === 'technology') && filteredClusters.filter(c => c.coverage === 1).length < 5) {
    const scrapedArticles = await fetchScrapedPopularArticles();
    
    // Filter scraped articles by section
    const sectionScrapedArticles = scrapedArticles.filter(article => {
      if (section === 'australia') {
        return article.source.includes('ABC News Australia');
      }
      if (section === 'technology') {
        return article.source === 'Ars Technica';
      }
      return false;
    });
    
    // Create clusters from scraped articles (they won't cluster with RSS items due to different sources)
    const scrapedClusters = clusterNewsItems(sectionScrapedArticles, 0.18);
    
    // Add scraped clusters that don't duplicate existing content
    const existingUrls = new Set(filteredClusters.flatMap(c => c.items.map(i => i.url)));
    const newScrapedClusters = scrapedClusters.filter(cluster => 
      !cluster.items.some(item => existingUrls.has(item.url))
    );
    
    filteredClusters.push(...newScrapedClusters);
  }

  // Calculate popularity scores for each cluster
  filteredClusters.forEach(cluster => {
    cluster.popularity_score = calculatePopularityScore(cluster, section);
  });

  // Sort by popularity score (higher = more popular)
  filteredClusters.sort((a, b) => {
    return (b.popularity_score || 0) - (a.popularity_score || 0);
  });

  // AI processing will be done in batch for all sections at once

  const data: SectionData = {
    updated_at: new Date().toISOString(),
    clusters: filteredClusters.slice(0, 50) // Limit to top 50 clusters
  };

  return data;
}

async function processMedicalSections(): Promise<MedicalSectionData> {
  console.log('Processing medical sections');
  
  // Refresh each medical subsection
  const subsections = ['clinical', 'professional', 'patient_signals'];
  
  const results = await Promise.all(subsections.map(async (subsection) => {
    const sources = getFeedsBySection('medical', subsection);
    const items = await fetchAllFeeds(sources);
    const clusters = clusterNewsItems(items, 0.18); // Optimal threshold

    const data: SectionData = {
      updated_at: new Date().toISOString(),
      clusters: subsection === 'clinical' || subsection === 'professional' 
        ? clusters.slice(0, 5) // Only 5 for RACGP sections
        : clusters.slice(0, 20) // More for patient signals
    };

    return { subsection, data };
  }));

  // Handle month in research separately (would be scraped from EvidenceAlerts)
  const researchItems = await fetchEvidenceAlerts();
  const researchData: SectionData = {
    updated_at: new Date().toISOString(),
    clusters: [] // Would contain research articles
  };

  const response: MedicalSectionData = {
    clinical: results.find(r => r.subsection === 'clinical')?.data || { clusters: [], updated_at: new Date().toISOString() },
    professional: results.find(r => r.subsection === 'professional')?.data || { clusters: [], updated_at: new Date().toISOString() },
    patient_signals: results.find(r => r.subsection === 'patient_signals')?.data || { clusters: [], updated_at: new Date().toISOString() },
    month_in_research: researchData
  };

  return response;
}

function calculatePopularityScore(cluster: NewsCluster, section: string): number {
  let score = 0;
  
  // Base score from coverage (multi-source stories are inherently more popular)
  // Multi-source articles get much higher base scores to ensure they always rank above single-source
  if (cluster.coverage >= 2) {
    score += cluster.coverage * 1000; // 2000+ for 2-source, 3000+ for 3-source, etc.
  } else {
    score += 100; // Single-source articles start much lower
  }
  
  // For single-source trusted articles, use content-based popularity indicators
  if (cluster.coverage === 1) {
    const item = cluster.items[0];
    
    // Higher bonus for scraped articles (they come from "popular" sections)
    if (item.feed_position !== undefined && item.feed_position < 10) {
      // Scraped articles get massive bonus since they're from curated popular sections
      score += 200 - (item.feed_position * 10); // First scraped article gets 200, second gets 190, etc.
    }
    
    // Bonus for trusted sources (these are allowed single-source articles)
    const trustedSources = {
      'australia': ['ABC News Australia', 'ABC Just In', 'ABC News Australia (Popular)'],
      'technology': ['Ars Technica', 'Ars Technica Main']
    };
    
    if (section in trustedSources) {
      const trusted = trustedSources[section as keyof typeof trustedSources];
      if (trusted.includes(item.source)) {
        score += 30; // Trusted source bonus
      }
    }
    
    // Content quality and popularity indicators
    const title = item.title.toLowerCase();
    const content = (item.standfirst || item.content || '').toLowerCase();
    
    // Technology-specific popularity indicators
    if (section === 'technology') {
      // High interest tech topics
      if (title.includes('ai') || title.includes('artificial intelligence') || title.includes('chatgpt') || title.includes('gpt')) score += 15;
      if (title.includes('apple') || title.includes('iphone') || title.includes('google') || title.includes('microsoft')) score += 12;
      if (title.includes('security') || title.includes('privacy') || title.includes('hack')) score += 10;
      if (title.includes('climate') || title.includes('space') || title.includes('mars')) score += 8;
      if (title.includes('bitcoin') || title.includes('crypto') || title.includes('blockchain')) score += 8;
      if (title.includes('tesla') || title.includes('electric') || title.includes('ev')) score += 6;
      
      // Content type indicators
      if (title.includes('review') || title.includes('test')) score += 5;
      if (title.includes('breaking') || title.includes('exclusive')) score += 8;
    }
    
    // Australia-specific popularity indicators  
    if (section === 'australia') {
      // High interest topics
      if (title.includes('election') || title.includes('politics') || title.includes('government')) score += 12;
      if (title.includes('economy') || title.includes('housing') || title.includes('interest rate')) score += 10;
      if (title.includes('climate') || title.includes('bushfire') || title.includes('flood')) score += 8;
      if (title.includes('sydney') || title.includes('melbourne') || title.includes('brisbane')) score += 6;
      if (title.includes('sport') || title.includes('afl') || title.includes('nrl')) score += 5;
      
      // News type indicators
      if (title.includes('breaking') || title.includes('live') || title.includes('urgent')) score += 10;
      if (title.includes('exclusive') || title.includes('investigation')) score += 8;
    }
    
    // Length and quality indicators (longer titles often indicate more significant stories)
    if (title.length > 50 && title.length < 120) score += 3;
    
    // Avoid less newsworthy content
    if (title.includes('weather') || title.includes('traffic')) score -= 5;
    if (title.includes('sport') && section !== 'australia') score -= 3; // Sports less relevant in tech
  }
  
  // Recency factor (more recent = slightly higher score)
  const hoursOld = (Date.now() - new Date(cluster.updated_at).getTime()) / (1000 * 60 * 60);
  const recencyBonus = Math.max(0, 20 - hoursOld); // Up to 20 points for very recent stories
  score += recencyBonus;
  
  return score;
}

async function main() {
  try {
    // Ensure data directory exists
    await fs.mkdir('data', { recursive: true });
    
    console.log('Starting news processing...');
    
    // Process all sections in parallel
    const [globalData, australiaData, technologyData, medicalData] = await Promise.all([
      processSection('global'),
      processSection('australia'),
      processSection('technology'),
      processMedicalSections()
    ]);
    
    // Batch AI processing for ALL clusters from ALL sections in a single API call
    const hasAI = checkAI();
    if (hasAI) {
      try {
        // Collect all clusters that need AI processing
        const allClusters = [
          ...globalData.clusters,
          ...australiaData.clusters,
          ...technologyData.clusters
        ];
        
        console.log(`Generating AI summaries for ${allClusters.length} clusters from all sections with Gemini API (single batch call)`);
        
        // Process ALL clusters in one API call
        await generateBatchAISummaries(allClusters, { GEMINI_API_KEY: process.env.GEMINI_API_KEY });
        console.log('Consolidated batch AI processing completed successfully');
        
      } catch (error) {
        console.error('Consolidated batch AI processing failed:', error);
        // Clusters will keep their original titles and no AI summaries
      }
    } else {
      console.log('AI processing disabled - no Gemini API key');
    }
    
    // Write data to JSON files
    await Promise.all([
      fs.writeFile('data/global.json', JSON.stringify(globalData, null, 2)),
      fs.writeFile('data/australia.json', JSON.stringify(australiaData, null, 2)),
      fs.writeFile('data/technology.json', JSON.stringify(technologyData, null, 2)),
      fs.writeFile('data/medical.json', JSON.stringify(medicalData, null, 2))
    ]);
    
    console.log('News processing completed successfully!');
    console.log(`Global: ${globalData.clusters.length} clusters`);
    console.log(`Australia: ${australiaData.clusters.length} clusters`);
    console.log(`Technology: ${technologyData.clusters.length} clusters`);
    console.log(`Medical: Clinical ${medicalData.clinical.clusters.length}, Professional ${medicalData.professional.clusters.length}, Patient Signals ${medicalData.patient_signals.clusters.length}`);
    
  } catch (error) {
    console.error('News processing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}