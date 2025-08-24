import crypto from 'crypto';

/**
 * Normalize text for fuzzy matching
 * - Converts to lowercase
 * - Removes punctuation and extra spaces
 * - Standardizes common medical spelling variations
 */
export function normalizeTitle(text: string): string {
  let normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();

  // Standardize common medical spelling variations (US/UK)
  const spellingVariations: [RegExp, string][] = [
    [/\bhaemorrhage\b/g, 'hemorrhage'],
    [/\bhaemorrhagic\b/g, 'hemorrhagic'],
    [/\banaemia\b/g, 'anemia'],
    [/\banaemic\b/g, 'anemic'],
    [/\boedema\b/g, 'edema'],
    [/\boesophag/g, 'esophag'],
    [/\baetiology\b/g, 'etiology'],
    [/\bpaediatric\b/g, 'pediatric'],
    [/\bgynaecolog/g, 'gynecolog'],
    [/\borthopaedic\b/g, 'orthopedic'],
    // Handle caesarean/cesarean with or without spaces
    [/\bplannedcaesarean\b/gi, 'planned cesarean'],
    [/\bcaesarean\b/g, 'cesarean'],
    [/\bcaesarian\b/g, 'cesarean'],
    [/\bcentre\b/g, 'center'],
    [/\bfibre\b/g, 'fiber'],
    [/\btumour\b/g, 'tumor'],
    [/\bfavour\b/g, 'favor'],
    [/\bcolour\b/g, 'color'],
    [/\blabour\b/g, 'labor'],
    [/\bbehaviour\b/g, 'behavior'],
    [/\banalyse\b/g, 'analyze'],
    [/\borganise\b/g, 'organize'],
    [/\brandomised\b/g, 'randomized'],
    [/\bstandardised\b/g, 'standardized'],
    [/\boptimised\b/g, 'optimized'],
    [/\bimmunisation\b/g, 'immunization'],
    [/\bhospitalisation\b/g, 'hospitalization']
  ];

  for (const [pattern, replacement] of spellingVariations) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

/**
 * Extract character-level shingles for similarity comparison
 * Uses k-grams (substrings of length k) for robust matching
 */
export function extractShingles(text: string, k: number = 3): Set<string> {
  const normalized = normalizeTitle(text);
  const shingles = new Set<string>();
  
  // Add word-level tokens for better accuracy with medical titles
  const words = normalized.split(' ');
  words.forEach(word => {
    if (word.length >= 2) {
      shingles.add(word);
    }
  });
  
  // Add character-level shingles
  for (let i = 0; i <= normalized.length - k; i++) {
    shingles.add(normalized.substring(i, i + k));
  }
  
  return shingles;
}

/**
 * Calculate Jaccard similarity between two sets
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Check if two titles are similar enough to be considered duplicates
 * Uses a combination of normalized comparison and Jaccard similarity
 */
export function areTitlesSimilar(title1: string, title2: string, threshold: number = 0.85): boolean {
  // Quick check: if normalized titles are identical
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  if (norm1 === norm2) {
    return true;
  }
  
  // Calculate similarity using shingles
  const shingles1 = extractShingles(title1);
  const shingles2 = extractShingles(title2);
  const similarity = jaccardSimilarity(shingles1, shingles2);
  
  return similarity >= threshold;
}

/**
 * Generate a normalized article ID that will be consistent across spelling variations
 */
export function generateNormalizedId(title: string, journal: string): string {
  const normalizedContent = `${normalizeTitle(title)}_${normalizeTitle(journal)}`;
  return crypto.createHash('md5').update(normalizedContent).digest('hex').substring(0, 12);
}

/**
 * Find potential duplicates in a list of articles
 * Returns a map of normalized IDs to arrays of original IDs that are duplicates
 */
export function findDuplicateGroups(
  articles: Array<{ id: string; title: string; journal: string }>,
  threshold: number = 0.85
): Map<string, string[]> {
  const duplicateGroups = new Map<string, string[]>();
  const processed = new Set<string>();
  
  for (let i = 0; i < articles.length; i++) {
    if (processed.has(articles[i].id)) continue;
    
    const group = [articles[i].id];
    const normalizedId = generateNormalizedId(articles[i].title, articles[i].journal);
    
    for (let j = i + 1; j < articles.length; j++) {
      if (processed.has(articles[j].id)) continue;
      
      // Check if same journal and similar titles
      if (articles[i].journal === articles[j].journal &&
          areTitlesSimilar(articles[i].title, articles[j].title, threshold)) {
        group.push(articles[j].id);
        processed.add(articles[j].id);
      }
    }
    
    if (group.length > 1) {
      duplicateGroups.set(normalizedId, group);
      group.forEach(id => processed.add(id));
    }
  }
  
  return duplicateGroups;
}