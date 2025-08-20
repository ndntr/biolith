import { NewsItem, NewsCluster } from './types';
import {
  extractShingles,
  jaccardSimilarity,
  isSameArticle,
  selectBestHeadline
} from './normalize';

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

export function clusterNewsItems(items: NewsItem[], similarityThreshold: number = 0.6): NewsCluster[] {
  if (items.length === 0) return [];

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
      
      if (similarity >= similarityThreshold) {
        uf.union(id1, id2);
      }
    }
  }

  // Build clusters from Union-Find structure
  const clusterMap = uf.getClusters();
  const clusters: NewsCluster[] = [];

  // Build clusters from grouped items
  for (const [rootId, memberIds] of clusterMap) {
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
  
  // Sort clusters by coverage (descending), then by date (newest first)
  clusters.sort((a, b) => {
    if (a.coverage !== b.coverage) {
      return b.coverage - a.coverage;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  
  return clusters;
}