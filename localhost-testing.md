# Localhost Testing Setup

## Local Development Server

The local development server is currently running at:
**http://localhost:61476**

### To start the server manually:
```bash
cd /Users/anindaantar/Documents/Development/Websites/biolith
python3 -m http.server 61476
```

### To test mobile responsiveness:
1. Open your browser's developer tools (F12)
2. Click the device toolbar icon to enable mobile view
3. Select a mobile device preset (e.g., iPhone, Pixel)
4. Navigate to http://localhost:61476

### Recent Changes Made:
1. **PubMed button text**: Changed from "VIEW ON PUBMED" to "PUBMED ↗"
2. **Mobile font sizes**: Set to 13px for these classes on mobile (768px and below):
   - `.abstract-text`
   - `.evidence-summary-content`
   - `.brief-content`
   - `.modal-sources-section`
   - `.modal-header`
3. **Modal image aspect ratio**: Fixed mobile modal images to maintain proper rectangular ratio with min-height: 200px

### Testing the Changes:
1. Open a news article modal to test the image aspect ratio fix
2. Open an evidence article modal to test the "PUBMED ↗" button text
3. Test mobile view (768px width or below) to verify 13px font sizes in modals