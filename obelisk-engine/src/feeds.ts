import { FeedSource } from './types';

export const FEED_SOURCES: FeedSource[] = [
  // Global sources - mix of international news outlets
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', type: 'rss', section: 'global' },
  { name: 'BBC Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml', type: 'rss', section: 'global' },
  { name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', type: 'rss', section: 'global' },
  { name: 'Guardian Business', url: 'https://www.theguardian.com/business/rss', type: 'rss', section: 'global' },
  { name: 'Sky News World', url: 'https://feeds.skynews.com/feeds/rss/world.xml', type: 'rss', section: 'global' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'rss', section: 'global' },
  { name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-top', type: 'rss', section: 'global' },
  { name: 'France24', url: 'https://www.france24.com/en/rss', type: 'rss', section: 'global' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', type: 'rss', section: 'global' },
  { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', type: 'rss', section: 'global' },
  { name: 'Time Magazine', url: 'https://feeds.feedburner.com/time/topstories', type: 'rss', section: 'global' },
  { name: 'Businessweek', url: 'https://feeds.feedburner.com/businessweek', type: 'rss', section: 'global' },
  // Additional Global sources (tested and verified)
  { name: 'WSJ World', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', type: 'rss', section: 'global' },
  { name: 'Reuters Top News', url: 'https://feeds.feedburner.com/reuters/topNews', type: 'rss', section: 'global' },
  { name: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main', type: 'rss', section: 'global' },
  { name: 'NBC World', url: 'https://feeds.nbcnews.com/nbcnews/public/world', type: 'rss', section: 'global' },
  { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml', type: 'rss', section: 'global' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', type: 'rss', section: 'global' },
  { name: 'Ars Technica News', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', type: 'rss', section: 'global' },
  { name: 'Bloomberg Technology', url: 'https://feeds.bloomberg.com/technology/news.rss', type: 'rss', section: 'global' },
  { name: 'Financial Times', url: 'https://www.ft.com/rss/home', type: 'rss', section: 'global' },

  // Australia sources
  { name: 'ABC News Australia', url: 'https://www.abc.net.au/news/feed/45910/rss.xml', type: 'rss', section: 'australia' },
  { name: 'Guardian Australia', url: 'https://www.theguardian.com/australia-news/rss', type: 'rss', section: 'australia' },
  { name: 'ABC Just In', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', type: 'rss', section: 'australia' },
  // Additional Australia sources (tested and verified)
  { name: 'The Age', url: 'https://www.theage.com.au/rss/feed.xml', type: 'rss', section: 'australia' },
  { name: '9News', url: 'https://www.9news.com.au/rss', type: 'rss', section: 'australia' },
  { name: 'Crikey', url: 'https://www.crikey.com.au/feed/', type: 'rss', section: 'australia' },
  { name: 'Canberra Times', url: 'https://www.canberratimes.com.au/rss.xml', type: 'rss', section: 'australia' },

  // Technology sources  
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', type: 'rss', section: 'technology' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss', section: 'technology' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', type: 'rss', section: 'technology' },
  { name: 'Guardian Tech', url: 'https://www.theguardian.com/technology/rss', type: 'rss', section: 'technology' },
  // Additional Technology sources (tested and verified)
  { name: 'Ars Technica Main', url: 'https://arstechnica.com/feed/', type: 'rss', section: 'technology' },
  { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml', type: 'rss', section: 'technology' },
  { name: 'Wired Tech', url: 'https://www.wired.com/feed/rss', type: 'rss', section: 'technology' },
  { name: 'TechMeme', url: 'https://www.techmeme.com/feed.xml', type: 'rss', section: 'technology' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', type: 'rss', section: 'technology' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', type: 'rss', section: 'technology' },

  // Medical sources - mix of health and science feeds
  { name: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', type: 'rss', section: 'medical', subsection: 'patient_signals' },
  { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', type: 'rss', section: 'medical', subsection: 'patient_signals' },
  { name: 'Guardian Health', url: 'https://www.theguardian.com/society/health/rss', type: 'rss', section: 'medical', subsection: 'patient_signals' },
  { name: 'newsGP', url: 'https://www1.racgp.org.au/newsgp?rss=RACGPnewsGPArticles', type: 'rss', section: 'medical', subsection: 'professional' },
];

export function getFeedsBySection(section: string, subsection?: string): FeedSource[] {
  return FEED_SOURCES.filter(feed => {
    if (subsection) {
      return feed.section === section && feed.subsection === subsection;
    }
    return feed.section === section && !feed.subsection;
  });
}