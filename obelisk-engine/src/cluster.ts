import { NewsItem, NewsCluster } from './types';
import {
  extractShingles,
  jaccardSimilarity,
  isSameArticle,
  selectBestHeadline
} from './normalize';

// Configuration options for clustering
export interface ClusterOptions {
  similarityThreshold?: number;  // Threshold for Union-Find merging (default: 0.18)
  minPairSimilarity?: number;    // Minimum similarity for ALL pairs in a cluster (default: 0.08)
}

// Default configurations per section
export const CLUSTER_CONFIGS: Record<string, ClusterOptions> = {
  global: { similarityThreshold: 0.18, minPairSimilarity: 0.08 },
  australia: { similarityThreshold: 0.18, minPairSimilarity: 0.08 },
  technology: { similarityThreshold: 0.25, minPairSimilarity: 0.12 },
  medical: { similarityThreshold: 0.20, minPairSimilarity: 0.10 }
};

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  makeSet(x: string): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: string): string {
    this.makeSet(x);
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    
    for (const [item] of this.parent) {
      const root = this.find(item);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(item);
    }
    
    return clusters;
  }
}

// Validate that all pairs in a cluster meet minimum similarity threshold
function validateCluster(
  memberIds: string[],
  similarityMap: Map<string, number>,
  minPairSimilarity: number
): boolean {
  if (memberIds.length <= 1) return true;

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      // Create consistent key (smaller id first)
      const id1 = memberIds[i];
      const id2 = memberIds[j];
      const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;

      const similarity = similarityMap.get(key) || 0;
      if (similarity < minPairSimilarity) {
        return false;  // Cluster contains unrelated articles (transitive false positive)
      }
    }
  }
  return true;
}

export function clusterNewsItems(
  items: NewsItem[],
  optionsOrThreshold: ClusterOptions | number = {}
): NewsCluster[] {
  if (items.length === 0) return [];

  // Support legacy number argument for backward compatibility
  const options: ClusterOptions = typeof optionsOrThreshold === 'number'
    ? { similarityThreshold: optionsOrThreshold }
    : optionsOrThreshold;

  const similarityThreshold = options.similarityThreshold ?? 0.18;
  const minPairSimilarity = options.minPairSimilarity ?? 0.08;

  // Deduplicate by URL first
  const uniqueItems = new Map<string, NewsItem>();
  const itemIds = new Map<NewsItem, string>();

  items.forEach((item, index) => {
    const id = `item_${index}`;
    itemIds.set(item, id);

    // Check if we already have this exact article
    let isDuplicate = false;
    for (const [existingId, existingItem] of uniqueItems) {
      if (isSameArticle(item, existingItem)) {
        isDuplicate = true;
        // Keep the one with more content
        if ((item.content?.length || 0) > (existingItem.content?.length || 0)) {
          uniqueItems.set(existingId, item);
        }
        break;
      }
    }

    if (!isDuplicate) {
      uniqueItems.set(id, item);
    }
  });

  // Create shingles for each unique item
  const itemShingles = new Map<string, Set<string>>();

  for (const [id, item] of uniqueItems) {
    const text = `${item.title} ${item.standfirst || ''}`;
    const shingles3 = extractShingles(text, 3);
    const shingles4 = extractShingles(text, 4);
    const shingles5 = extractShingles(text, 5);

    // Combine different shingle sizes for better matching
    const combined = new Set([...shingles3, ...shingles4, ...shingles5]);
    itemShingles.set(id, combined);
  }

  // Build similarity graph using Union-Find
  const uf = new UnionFind();
  const itemIdArray = Array.from(uniqueItems.keys());

  // Store pairwise similarities for cluster validation
  const similarityMap = new Map<string, number>();

  // Initialize all items as separate sets
  itemIdArray.forEach(id => uf.makeSet(id));

  // Compare all pairs and union if similar
  for (let i = 0; i < itemIdArray.length; i++) {
    for (let j = i + 1; j < itemIdArray.length; j++) {
      const id1 = itemIdArray[i];
      const id2 = itemIdArray[j];

      const shingles1 = itemShingles.get(id1)!;
      const shingles2 = itemShingles.get(id2)!;

      const similarity = jaccardSimilarity(shingles1, shingles2);

      // Store similarity for later validation (consistent key ordering)
      const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
      similarityMap.set(key, similarity);

      if (similarity >= similarityThreshold) {
        uf.union(id1, id2);
      }
    }
  }

  // Build clusters from Union-Find structure
  const clusterMap = uf.getClusters();
  const clusters: NewsCluster[] = [];

  // Track items that failed validation and need to become singletons
  const invalidClusterItems: string[] = [];

  // Build clusters from grouped items
  for (const [rootId, memberIds] of clusterMap) {
    // Validate cluster - check that all pairs meet minimum similarity
    if (memberIds.length > 1 && !validateCluster(memberIds, similarityMap, minPairSimilarity)) {
      // Cluster failed validation - items will become singletons
      invalidClusterItems.push(...memberIds);
      continue;
    }

    const clusterItems = memberIds.map(id => uniqueItems.get(id)!);

    // Calculate unique sources for coverage
    const sources = new Set(clusterItems.map(item => item.source));

    // Sort items by date (newest first)
    clusterItems.sort((a, b) => {
      const dateA = new Date(a.published_at).getTime();
      const dateB = new Date(b.published_at).getTime();
      return dateB - dateA;
    });

    // Select the best headline from available sources
    const clusterTitle = clusterItems[0].title;
    const clusterHeadline = selectBestHeadline(clusterItems);

    clusters.push({
      id: `cluster_${clusters.length}`,
      coverage: sources.size,
      updated_at: clusterItems[0].published_at,
      title: clusterTitle,
      neutral_headline: clusterHeadline,
      items: clusterItems,
      featured_image: clusterItems.find(item => item.image_url)?.image_url
    });
  }

  // Create singleton clusters for items from invalid clusters
  for (const itemId of invalidClusterItems) {
    const item = uniqueItems.get(itemId)!;
    clusters.push({
      id: `cluster_${clusters.length}`,
      coverage: 1,
      updated_at: item.published_at,
      title: item.title,
      neutral_headline: selectBestHeadline([item]),
      items: [item],
      featured_image: item.image_url
    });
  }

  // Sort clusters by coverage (descending), then by date (newest first)
  clusters.sort((a, b) => {
    if (a.coverage !== b.coverage) {
      return b.coverage - a.coverage;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return clusters;
}