# RSS Content Structure Reference

**DO NOT COMMIT THIS FILE - FOR DEBUGGING REFERENCE ONLY**

## RSS Feed Analysis

From WebFetch analysis of the Kill the Newsletter RSS feed:

### Structure
- Feed format: Atom (uses `<content type="html">` tags)
- Content size: ~75KB of richly formatted newsletter content
- Articles: 5 medical research article summaries
- Newsletter recipient: "Aninda Antar"

### Content Organization
- Full HTML email newsletter structure
- Multiple article summaries with titles, journals, scores
- Detailed HTML formatting with tables, links, images
- Footer information

### Parser Issue
- RSS feed contains full content in `<content type="html">` tags
- Current parser only extracts 15 characters (likely due to improper Atom content handling)
- Content is HTML-encoded within XML structure
- Needs proper HTML entity decoding

### Required Fixes
1. Handle Atom `<content type="html">` structure properly
2. Decode HTML entities in XML content
3. Parse decoded HTML to extract article data
4. Validate content length (should be ~75KB, not 15 chars)

## Current RSS Item Structure (Expected)
```
item: {
  content: {
    type: "html",
    value: "HTML-encoded content here..."
  }
  // or potentially:
  content: "HTML-encoded content as string"
}
```