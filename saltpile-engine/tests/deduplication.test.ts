import { describe, it, expect } from '@jest/globals';
import {
  normalizeTitle,
  extractShingles,
  jaccardSimilarity,
  areTitlesSimilar,
  generateNormalizedId,
  findDuplicateGroups
} from '../src/deduplication';

describe('Deduplication Functions', () => {
  describe('normalizeTitle', () => {
    it('should normalize case and punctuation', () => {
      expect(normalizeTitle('Hello, World!')).toBe('hello world');
      expect(normalizeTitle('Test: Article (2024)')).toBe('test article 2024');
    });

    it('should normalize medical spelling variations', () => {
      expect(normalizeTitle('Haemorrhage in patients')).toBe('hemorrhage in patients');
      expect(normalizeTitle('Paediatric anaemia treatment')).toBe('pediatric anemia treatment');
      expect(normalizeTitle('Caesarean delivery outcomes')).toBe('cesarean delivery outcomes');
      expect(normalizeTitle('Randomised controlled trial')).toBe('randomized controlled trial');
    });

    it('should handle multiple variations in one title', () => {
      const title = 'Effects of Prophylactic Oxytocin on Postpartum Haemorrhage at PlannedCaesarean Delivery';
      const normalized = 'effects of prophylactic oxytocin on postpartum hemorrhage at plannedcesarean delivery';
      expect(normalizeTitle(title)).toBe(normalized);
    });
  });

  describe('extractShingles', () => {
    it('should extract character and word shingles', () => {
      const shingles = extractShingles('test case');
      expect(shingles.has('test')).toBe(true);
      expect(shingles.has('case')).toBe(true);
      expect(shingles.has('tes')).toBe(true);
      expect(shingles.has('est')).toBe(true);
    });

    it('should handle normalized text', () => {
      const shingles1 = extractShingles('Haemorrhage');
      const shingles2 = extractShingles('Hemorrhage');
      // Should have high overlap due to normalization
      const similarity = jaccardSimilarity(shingles1, shingles2);
      expect(similarity).toBe(1); // Should be identical after normalization
    });
  });

  describe('jaccardSimilarity', () => {
    it('should calculate correct similarity', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);
      expect(jaccardSimilarity(set1, set2)).toBeCloseTo(0.5, 2); // 2 common / 4 total
    });

    it('should handle empty sets', () => {
      expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
      expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
    });

    it('should handle identical sets', () => {
      const set = new Set(['a', 'b', 'c']);
      expect(jaccardSimilarity(set, set)).toBe(1);
    });
  });

  describe('areTitlesSimilar', () => {
    it('should detect exact duplicates', () => {
      const title = 'Effects of Treatment on Outcomes';
      expect(areTitlesSimilar(title, title)).toBe(true);
    });

    it('should detect spelling variation duplicates', () => {
      const title1 = 'Effects of Prophylactic Oxytocin or Carbetocin on Troponin Release and Postpartum Haemorrhage at PlannedCaesarean Delivery: A Double-Blind Randomised Controlled Trial.';
      const title2 = 'Effects of Prophylactic Oxytocin or Carbetocin on Troponin Release and Postpartum Haemorrhage at Planned Caesarean Delivery: A Double-Blind Randomised Controlled Trial.';
      expect(areTitlesSimilar(title1, title2)).toBe(true);
    });

    it('should detect US/UK spelling variations', () => {
      expect(areTitlesSimilar(
        'Randomised trial of paediatric haemorrhage management',
        'Randomized trial of pediatric hemorrhage management'
      )).toBe(true);
    });

    it('should not match completely different titles', () => {
      expect(areTitlesSimilar(
        'COVID-19 vaccine effectiveness',
        'Diabetes treatment guidelines'
      )).toBe(false);
    });

    it('should respect similarity threshold', () => {
      const title1 = 'Treatment of acute respiratory syndrome';
      const title2 = 'Management of acute respiratory syndrome';
      // Similar but not identical - should pass with lower threshold
      expect(areTitlesSimilar(title1, title2, 0.7)).toBe(true);
      expect(areTitlesSimilar(title1, title2, 0.95)).toBe(false);
    });
  });

  describe('generateNormalizedId', () => {
    it('should generate consistent IDs for spelling variations', () => {
      const id1 = generateNormalizedId('Haemorrhage treatment', 'BJOG');
      const id2 = generateNormalizedId('Hemorrhage treatment', 'BJOG');
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different titles', () => {
      const id1 = generateNormalizedId('Article One', 'JAMA');
      const id2 = generateNormalizedId('Article Two', 'JAMA');
      expect(id1).not.toBe(id2);
    });

    it('should normalize journal names too', () => {
      const id1 = generateNormalizedId('Same Title', 'British Journal');
      const id2 = generateNormalizedId('Same Title', 'BRITISH JOURNAL');
      expect(id1).toBe(id2);
    });
  });

  describe('findDuplicateGroups', () => {
    it('should find duplicate groups', () => {
      const articles = [
        { id: '1', title: 'Haemorrhage in surgery', journal: 'BJOG' },
        { id: '2', title: 'Hemorrhage in surgery', journal: 'BJOG' },
        { id: '3', title: 'Different article', journal: 'BJOG' },
        { id: '4', title: 'Paediatric care', journal: 'JAMA' },
        { id: '5', title: 'Pediatric care', journal: 'JAMA' }
      ];

      const groups = findDuplicateGroups(articles);
      expect(groups.size).toBe(2); // Two duplicate groups

      // Check that the right articles are grouped
      const groupArrays = Array.from(groups.values());
      expect(groupArrays).toContainEqual(['1', '2']);
      expect(groupArrays).toContainEqual(['4', '5']);
    });

    it('should not group articles from different journals', () => {
      const articles = [
        { id: '1', title: 'Same title', journal: 'JAMA' },
        { id: '2', title: 'Same title', journal: 'BJOG' }
      ];

      const groups = findDuplicateGroups(articles);
      expect(groups.size).toBe(0); // No duplicates (different journals)
    });

    it('should handle empty article list', () => {
      const groups = findDuplicateGroups([]);
      expect(groups.size).toBe(0);
    });
  });
});