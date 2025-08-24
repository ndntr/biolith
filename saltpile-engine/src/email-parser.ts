import fs from 'fs';
import * as cheerio from 'cheerio';
import { EmailArticleData } from './types.js';
import { cleanText, log } from './utils.js';

/**
 * Parse an .eml file and extract evidence articles
 * Simplified version for test mode only
 */
export async function parseEmailFile(emailPath: string): Promise<EmailArticleData[]> {
  try {
    log(`Parsing email file: ${emailPath}`);
    
    const emailContent = fs.readFileSync(emailPath, 'utf-8');
    
    // Simple extraction - assume the file contains HTML content
    return extractArticlesFromHtml(emailContent);
  } catch (error) {
    log(`Error parsing email file: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Parse email content buffer and extract evidence articles
 * Simplified version for test mode only
 */
export async function parseEmailBuffer(emailBuffer: Buffer): Promise<EmailArticleData[]> {
  try {
    log('Parsing email buffer');
    
    const emailContent = emailBuffer.toString('utf-8');
    return extractArticlesFromHtml(emailContent);
  } catch (error) {
    log(`Error parsing email buffer: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Extract articles from HTML content
 * Used by both RSS fetcher and email parser (test mode)
 */

/**
 * Extract articles from HTML content using cheerio
 * Simplified version for PubMed API lookup - only extracts title, journal, and tags
 */
export function extractArticlesFromHtml(htmlContent: string | any): EmailArticleData[] {
  // Ensure htmlContent is a string
  const content = typeof htmlContent === 'string' ? htmlContent : String(htmlContent || '');
  
  const $ = cheerio.load(content);
  const articles: EmailArticleData[] = [];

  log('Scanning HTML for article data');

  // Find all article links - try EvidenceAlerts links first, then fall back to article titles
  let $articleLinks = $('a[href*="plus.mcmaster.ca/EvidenceAlerts/LFE/Article"]');
  
  // If no EvidenceAlerts links, look for article titles in table rows with scores
  if ($articleLinks.length === 0) {
    log('No EvidenceAlerts links found, looking for article patterns in HTML', 'warn');
    
    // Debug: Log what we're searching in
    const htmlLength = content.length;
    const hasTable = content.includes('<table');
    const hasLinks = content.includes('<a ');
    const hasScore = content.includes('Score:');
    log(`HTML analysis: ${htmlLength} chars, table:${hasTable}, links:${hasLinks}, score:${hasScore}`);
    
    // If content is very short, log it for debugging
    if (htmlLength < 100) {
      log(`Short content detected: "${content.substring(0, 100)}"`);
    }
    
    // Look for table rows with article structure (has score image)
    const $scoreImages = $('img[alt*="Score:"]');
    if ($scoreImages.length > 0) {
      log(`Found ${$scoreImages.length} articles by score pattern`);
      
      // Process each article by finding its associated title
      $scoreImages.each((index, scoreImg) => {
        try {
          const $scoreImg = $(scoreImg);
          const $articleRow = $scoreImg.closest('tr');
          
          // Look for the title row (usually the previous row with an anchor or bold text)
          let $titleRow = $articleRow.prev('tr');
          let title = '';
          let evidenceAlertsUrl = '';
          
          // Try to find title in previous row
          if ($titleRow.length > 0) {
            const $titleLink = $titleRow.find('a').first();
            if ($titleLink.length > 0) {
              title = cleanText($titleLink.text());
              evidenceAlertsUrl = $titleLink.attr('href') || '';
            } else {
              // Try to find bold text as title
              const boldText = $titleRow.find('b, strong').text() || $titleRow.text();
              title = cleanText(boldText);
            }
          }
          
          if (!title) {
            log(`No title found for article ${index + 1}`, 'warn');
            return;
          }
          
          // Extract journal from the same row as score
          const $cells = $articleRow.find('td');
          let journal = '';
          if ($cells.length >= 2) {
            journal = cleanText($cells.eq(0).text());
          }
          
          // Extract score from image alt
          const altText = $scoreImg.attr('alt') || '';
          const scoreMatch = altText.match(/Score:\s*(\d+\/\d+)/);
          const score = scoreMatch ? scoreMatch[1] : '';
          
          // Extract tags from next row
          let tags: string[] = [];
          const $tagRow = $articleRow.next('tr');
          if ($tagRow.length > 0) {
            const tagText = $tagRow.text();
            if (tagText.includes('Tagged for:')) {
              const tagContent = tagText.replace('Tagged for:', '').trim();
              tags = tagContent.split(',').map(tag => cleanText(tag)).filter(tag => tag.length > 0);
            }
          }
          
          const article: EmailArticleData = {
            title,
            journal: journal || 'Unknown',
            score: score || '',
            tags,
            evidenceAlertsUrl
          };
          
          articles.push(article);
          log(`Extracted article: ${title} (${journal}) - Score: ${score}`);
        } catch (error) {
          log(`Error processing article ${index + 1}: ${error.message}`, 'error');
        }
      });
      
      log(`Successfully extracted ${articles.length} articles from content`);
      return articles;
    }
    
    // Final fallback: Look for article patterns in plain text
    log('Trying plain text pattern matching as final fallback');
    
    // Look for lines that match journal patterns
    const journalPattern = /^(JAMA|N Engl J Med|Lancet|BMJ|Ann Emerg Med|.*Medicine.*|.*Journal.*)/m;
    const scorePattern = /Score:\s*(\d+\/\d+)/;
    
    // Split content into lines and look for patterns
    const lines = content.split('\n');
    let currentArticle: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this looks like a title (long line before a journal name)
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (line.length > 20 && journalPattern.test(nextLine)) {
          // Save previous article if exists
          if (currentArticle && currentArticle.title) {
            articles.push({
              title: currentArticle.title,
              journal: currentArticle.journal || 'Unknown',
              score: currentArticle.score || '',
              tags: currentArticle.tags || [],
              evidenceAlertsUrl: ''
            });
          }
          
          // Start new article
          currentArticle = {
            title: cleanText(line.replace(/<[^>]*>/g, '')), // Remove HTML tags
            journal: cleanText(nextLine.replace(/<[^>]*>/g, ''))
          };
          log(`Found potential article: ${currentArticle.title}`);
        }
      }
      
      // Check for score
      if (currentArticle && scorePattern.test(line)) {
        const match = line.match(scorePattern);
        if (match) {
          currentArticle.score = match[1];
        }
      }
      
      // Check for tags
      if (currentArticle && line.includes('Tagged for:')) {
        const tagContent = line.replace('Tagged for:', '').trim();
        currentArticle.tags = tagContent.split(',').map(tag => cleanText(tag)).filter(tag => tag.length > 0);
      }
    }
    
    // Save last article
    if (currentArticle && currentArticle.title) {
      articles.push({
        title: currentArticle.title,
        journal: currentArticle.journal || 'Unknown',
        score: currentArticle.score || '',
        tags: currentArticle.tags || [],
        evidenceAlertsUrl: ''
      });
    }
    
    if (articles.length === 0) {
      log('No articles found in HTML content', 'warn');
    } else {
      log(`Found ${articles.length} articles using plain text matching`);
    }
    
    return articles;
  }
  
  log(`Found ${$articleLinks.length} article links in content`);

  $articleLinks.each((index, element) => {
    try {
      const $link = $(element);
      const evidenceAlertsUrl = $link.attr('href');
      
      // The title is the link text
      const title = cleanText($link.text());
      if (!title) {
        log(`No title found for article ${index + 1}`, 'warn');
        return;
      }

      // Try to find containing row for this article (old table format)
      const $articleRow = $link.closest('tr');
      
      // If no table row found, try the new format (h3 heading + subsequent paragraphs)
      if ($articleRow.length === 0) {
        log(`No table row found for article: ${title}, trying new format`, 'warn');
        
        // New format: article data is in sibling elements after the heading
        const $heading = $link.closest('h3');
        if ($heading.length > 0) {
          let journal = '';
          let score = '';
          let tags: string[] = [];
          
          // Look for journal in next paragraph (usually just the journal name in bold/strong)
          let $nextElement = $heading.next();
          while ($nextElement.length > 0 && (!journal || !score || tags.length === 0)) {
            const elementText = cleanText($nextElement.text());
            
            // Journal is typically in a <p> with <strong> tags
            if (!journal && ($nextElement.find('strong').length > 0 || $nextElement.is('strong'))) {
              const journalText = cleanText($nextElement.find('strong').text() || $nextElement.text());
              if (journalText && !journalText.toLowerCase().includes('alert') && !journalText.includes('⭐')) {
                journal = journalText;
                log(`Found journal in new format: ${journal}`);
              }
            }
            
            // Score is typically represented by stars (⭐)
            if (!score && elementText.includes('⭐')) {
              const starCount = (elementText.match(/⭐/g) || []).length;
              score = `${starCount}/7`;
              log(`Found score in new format: ${score}`);
            }
            
            // Tags are in "Tagged for:" paragraph
            if (tags.length === 0 && elementText.includes('Tagged for:')) {
              const tagContent = elementText.replace('Tagged for:', '').trim();
              tags = tagContent.split(',').map(tag => cleanText(tag)).filter(tag => tag.length > 0);
              log(`Found tags in new format: ${tags.join(', ')}`);
            }
            
            $nextElement = $nextElement.next();
          }
          
          // Create article data for new format
          const article: EmailArticleData = {
            title,
            journal: journal || 'Unknown',
            score: score || '',
            tags,
            evidenceAlertsUrl: evidenceAlertsUrl || ''
          };

          articles.push(article);
          log(`Extracted article (new format): ${title} (${journal}) - Score: ${score}`);
          return;
        }
        
        // If neither table row nor heading format works, skip this article
        log(`No suitable structure found for article: ${title}`, 'warn');
        return;
      }

      // Look in the next few rows for journal, score, and tags
      let journal = '';
      let score = '';
      let tags: string[] = [];

      // Check the next 3 rows after the title for article data
      let $currentRow = $articleRow.next('tr');
      for (let i = 0; i < 3 && $currentRow.length > 0; i++) {
        const $cells = $currentRow.find('td');
        const rowText = cleanText($currentRow.text());
        
        // Journal and score row: first cell has journal, second cell has score image
        if ($cells.length >= 2 && !rowText.includes('Tagged for:')) {
          const firstCellText = cleanText($cells.eq(0).text());
          if (firstCellText && firstCellText.length > 0 && firstCellText !== '--') {
            journal = firstCellText;
          }
          
          // Score is in the img alt attribute
          const $scoreImg = $cells.eq(1).find('img[alt*="Score:"]');
          if ($scoreImg.length > 0) {
            const altText = $scoreImg.attr('alt') || '';
            const scoreMatch = altText.match(/Score:\s*(\d+\/\d+)/);
            if (scoreMatch) {
              score = scoreMatch[1];
            }
          }
        }

        // Tags row: contains "Tagged for:"
        if (rowText.includes('Tagged for:')) {
          // Extract tags after "Tagged for:"
          const tagText = rowText.replace('Tagged for:', '').trim();
          if (tagText) {
            tags = tagText.split(',').map(tag => cleanText(tag)).filter(tag => tag.length > 0);
          }
        }

        $currentRow = $currentRow.next('tr');
      }

      // Create article data (URL optional since we use PubMed API)
      const article: EmailArticleData = {
        title,
        journal: journal || 'Unknown',
        score: score || '',
        tags,
        evidenceAlertsUrl: evidenceAlertsUrl || ''
      };

      articles.push(article);
      log(`Extracted article: ${title} (${journal}) - Score: ${score}`);
    } catch (error) {
      log(`Error processing article ${index + 1}: ${error.message}`, 'error');
    }
  });

  log(`Successfully extracted ${articles.length} articles from content`);
  return articles;
}

