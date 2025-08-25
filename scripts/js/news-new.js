// News aggregator frontend - New design
class NewsApp {
    constructor() {
        this.currentTab = 'global';
        this.newsData = {};
        this.clusterData = {}; 
        this.evidenceData = null;
        this.weatherData = null;
        this.weatherCache = { timestamp: 0, data: null };
        this.isAdmin = this.checkAdminAccess();
        this.medicalLensMode = 'patient'; // 'patient' or 'physician'
        this.init();
    }

    checkAdminAccess() {
        return window.location.search.includes('admin=true') || 
               localStorage.getItem('newsAdmin') === 'true';
    }

    init() {
        this.setupUI();
        this.updateCurrentDateTime();
        this.loadWeather();
        this.loadEvidence();
        this.loadAllSections();
        
        // Update datetime every second
        setInterval(() => this.updateCurrentDateTime(), 1000);
    }

    setupUI() {
        if (this.isAdmin) {
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) refreshButton.classList.add('admin');
        }
    }

    async loadAllSections() {
        try {
            const promises = [
                this.loadSection('global'),
                this.loadSection('australia'),
                this.loadSection('technology'),
                this.loadSection('medical')
            ];

            await Promise.allSettled(promises);
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error loading sections:', error);
        }
    }

    async loadSection(section) {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/ndntr/biolith/main/obelisk-engine/data/${section}.json`);
            
            if (!response.ok) {
                // Use dummy data for testing
                const dummyData = this.getDummyData(section);
                this.newsData[section] = dummyData;
                
                if (section === 'medical') {
                    this.renderMedicalSection(dummyData);
                } else {
                    this.renderSection(section, dummyData);
                }
                return;
            }
            
            const data = await response.json();
            this.newsData[section] = data;
            
            if (section === 'medical') {
                this.renderMedicalSection(data);
            } else {
                this.renderSection(section, data);
            }
        } catch (error) {
            console.error(`Error loading ${section}:`, error);
            // Use dummy data as fallback
            const dummyData = this.getDummyData(section);
            this.newsData[section] = dummyData;
            
            if (section === 'medical') {
                this.renderMedicalSection(dummyData);
            } else {
                this.renderSection(section, dummyData);
            }
        }
    }

    async loadEvidence() {
        try {
            console.log('Loading evidence data...');
            
            // Try local path first for testing
            let response = await fetch('./saltpile-engine/data/evidence.json');
            
            if (!response.ok) {
                // Fallback to GitHub path
                response = await fetch('https://raw.githubusercontent.com/ndntr/biolith/main/saltpile-engine/data/evidence.json');
            }
            
            if (!response.ok) {
                console.warn('Evidence data not found, using dummy data');
                this.evidenceData = this.getDummyEvidenceData();
            } else {
                this.evidenceData = await response.json();
                console.log(`Loaded ${this.evidenceData.articles.length} evidence articles`);
            }
            
            this.renderEvidenceSection();
            
        } catch (error) {
            console.error('Error loading evidence:', error);
            this.evidenceData = this.getDummyEvidenceData();
            this.renderEvidenceSection();
        }
    }

    getDummyEvidenceData() {
        return {
            updated_at: new Date().toISOString(),
            articles: [
                {
                    id: 'dummy1',
                    title: 'Sample Medical Research: Effects of Treatment X on Condition Y',
                    journal: 'JAMA',
                    score: '6/7',
                    tags: ['Cardiology', 'General Medicine'],
                    evidenceAlertsUrl: 'https://plus.mcmaster.ca/EvidenceAlerts/',
                    dateReceived: new Date().toISOString(),
                    isNew: true
                },
                {
                    id: 'dummy2',
                    title: 'Clinical Trial Results for New Drug Treatment',
                    journal: 'NEJM',
                    score: '7/7',
                    tags: ['Oncology', 'Pharmacology'],
                    evidenceAlertsUrl: 'https://plus.mcmaster.ca/EvidenceAlerts/',
                    dateReceived: new Date().toISOString(),
                    isNew: true
                }
            ]
        };
    }

    getDummyData(section) {
        const baseTime = Date.now();
        const clusters = [
            {
                id: '1',
                title: 'Allies hope Trump seeks Ukraine-Russia ceasefire',
                neutral_headline: 'Allies hope Trump seeks Ukraine-Russia ceasefire',
                coverage: 10,
                updated_at: new Date(baseTime - 60000).toISOString(), // 1 minute ago
                ai_summary: [
                    'European allies express cautious optimism about potential peace negotiations',
                    'Key NATO members signal readiness to support diplomatic initiatives',
                    'Military aid continues while diplomatic channels remain open',
                    'Regional stability concerns drive push for negotiated settlement',
                    'Timeline for potential talks remains unclear amid ongoing tensions'
                ],
                items: [
                    { 
                        title: 'European Leaders Push for Ukraine Peace Talks',
                        source: 'The Guardian', 
                        url: 'https://theguardian.com/world/ukraine-peace-talks' 
                    },
                    { 
                        title: 'NATO Allies Signal Support for Diplomatic Solution',
                        source: 'BBC News', 
                        url: 'https://bbc.com/news/world-europe-ukraine' 
                    },
                    { 
                        title: 'Ukraine Conflict: International Pressure for Ceasefire Grows',
                        source: 'Reuters', 
                        url: 'https://reuters.com/world/europe/ukraine-ceasefire' 
                    }
                ]
            },
            {
                id: '2',
                title: 'Europe faces record-breaking extreme heat',
                neutral_headline: 'Europe faces record-breaking extreme heat',
                coverage: 9,
                updated_at: new Date(baseTime - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
                items: [
                    { source: 'The Guardian', url: 'https://theguardian.com/test2' },
                    { source: 'BBC News', url: 'https://bbc.com/test2' }
                ]
            },
            {
                id: '3',
                title: 'Trump deployed National Guard to Washington',
                neutral_headline: 'Trump deployed National Guard to Washington',
                coverage: 1,
                updated_at: new Date(baseTime - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago
                items: [
                    { source: 'Washington Post', url: 'https://washingtonpost.com/test3' }
                ]
            },
            {
                id: '4',
                title: 'Nations negotiate plastics treaty, demand binding measures',
                neutral_headline: 'Nations negotiate plastics treaty, demand binding measures',
                coverage: 10,
                updated_at: new Date(baseTime - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                items: [
                    { source: 'The Guardian', url: 'https://theguardian.com/test4' },
                    { source: 'BBC News', url: 'https://bbc.com/test4' },
                    { source: 'Reuters', url: 'https://reuters.com/test4' }
                ]
            },
            {
                id: '5',
                title: 'US, Russia propose West Bank-style Ukraine occupation',
                neutral_headline: 'US, Russia propose West Bank-style Ukraine occupation',
                coverage: 10,
                updated_at: new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
                items: [
                    { source: 'The Guardian', url: 'https://theguardian.com/test5' },
                    { source: 'BBC News', url: 'https://bbc.com/test5' }
                ]
            },
            {
                id: '6',
                title: 'Climate summit reaches historic agreement on fossil fuels',
                neutral_headline: 'Climate summit reaches historic agreement on fossil fuels',
                coverage: 8,
                updated_at: new Date(baseTime - 3 * 24 * 60 * 60 * 1000).toISOString(),
                items: [
                    { source: 'CNN', url: 'https://cnn.com/test6' },
                    { source: 'BBC News', url: 'https://bbc.com/test6' }
                ]
            },
            {
                id: '7',
                title: 'Global markets surge on inflation data',
                neutral_headline: 'Global markets surge on inflation data',
                coverage: 6,
                updated_at: new Date(baseTime - 4 * 24 * 60 * 60 * 1000).toISOString(),
                items: [
                    { source: 'Bloomberg', url: 'https://bloomberg.com/test7' },
                    { source: 'Financial Times', url: 'https://ft.com/test7' }
                ]
            }
        ];

        // Special structure for medical section
        if (section === 'medical') {
            return {
                clinical: {
                    clusters: clusters.slice(0, 2),
                    updated_at: new Date().toISOString()
                },
                professional: {
                    clusters: clusters.slice(2, 5),
                    updated_at: new Date().toISOString()
                },
                patient_signals: {
                    clusters: clusters.slice(5, 7),
                    updated_at: new Date().toISOString()
                },
                month_in_research: {
                    clusters: clusters.slice(0, 1),
                    updated_at: new Date().toISOString()
                }
            };
        }

        return {
            clusters: clusters,
            metadata: {
                last_updated: new Date().toISOString()
            }
        };
    }

    renderSection(section, data) {
        const topContainer = document.getElementById(`${section}TopStories`);
        const moreContainer = document.getElementById(`${section}MoreStories`);
        
        if (!topContainer || !moreContainer) return;

        if (!data.clusters || data.clusters.length === 0) {
            topContainer.innerHTML = '<div class="loading">No stories available</div>';
            moreContainer.innerHTML = '';
            return;
        }

        try {
            // Store cluster data for modal access
            data.clusters.forEach(cluster => {
                const uniqueId = `${section}_${cluster.id}`;
                this.clusterData[uniqueId] = cluster;
            });

            // Split stories into top and more
            const topStories = data.clusters.slice(0, 5);
            const moreStories = data.clusters.slice(5, 10);

            topContainer.innerHTML = topStories.map(cluster => {
                try {
                    return this.renderStory(cluster, section);
                } catch (error) {
                    console.error('Error rendering story:', error, cluster);
                    return '<div class="news-story error">Error loading story</div>';
                }
            }).join('');
            
            if (moreStories.length > 0) {
                moreContainer.innerHTML = moreStories.map(cluster => {
                    try {
                        return this.renderStory(cluster, section);
                    } catch (error) {
                        console.error('Error rendering more story:', error, cluster);
                        return '<div class="news-story error">Error loading story</div>';
                    }
                }).join('');
            } else {
                moreContainer.innerHTML = '';
            }
        } catch (error) {
            console.error('Error in renderSection:', error);
            topContainer.innerHTML = '<div class="loading">Error loading news</div>';
            moreContainer.innerHTML = '';
        }
    }

    renderMedicalSection(data) {
        // Store all cluster data for modal access
        const allClusters = [
            ...(data.clinical?.clusters || []).map(c => ({...c, _section: 'medical_clinical'})),
            ...(data.professional?.clusters || []).map(c => ({...c, _section: 'medical_professional'})),
            ...(data.patient_signals?.clusters || []).map(c => ({...c, _section: 'medical_patient'})),
            ...(data.month_in_research?.clusters || []).map(c => ({...c, _section: 'medical_research'}))
        ];
        
        allClusters.forEach(cluster => {
            const uniqueId = `${cluster._section}_${cluster.id}`;
            this.clusterData[uniqueId] = cluster;
        });

        // Render based on current lens mode
        this.updateMedicalTopStories(data);
        
        // Render more stories (always patient lens content for now)
        const patientClusters = [
            ...(data.clinical?.clusters || []).map(c => ({...c, _section: 'medical_clinical'})),
            ...(data.patient_signals?.clusters || []).map(c => ({...c, _section: 'medical_patient'})),
            ...(data.month_in_research?.clusters || []).map(c => ({...c, _section: 'medical_research'}))
        ];
        
        patientClusters.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        const moreStories = patientClusters.slice(5, 10);

        const moreContainer = document.getElementById('medicalMoreStories');
        if (moreContainer) {
            moreContainer.innerHTML = moreStories.map(cluster => 
                this.renderStory(cluster, cluster._section)
            ).join('') || '';
        }
    }

    updateMedicalTopStories(data) {
        const topContainer = document.getElementById('medicalTopStories');
        if (!topContainer) return;

        let topStories = [];
        
        if (this.medicalLensMode === 'patient') {
            // Patient lens: clinical, patient_signals, month_in_research
            const patientClusters = [
                ...(data.clinical?.clusters || []).map(c => ({...c, _section: 'medical_clinical'})),
                ...(data.patient_signals?.clusters || []).map(c => ({...c, _section: 'medical_patient'})),
                ...(data.month_in_research?.clusters || []).map(c => ({...c, _section: 'medical_research'}))
            ];
            patientClusters.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            topStories = patientClusters.slice(0, 5);
        } else {
            // Physician lens: professional (newsGP)
            const physicianClusters = (data.professional?.clusters || []).map(c => ({...c, _section: 'medical_professional'}));
            physicianClusters.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            topStories = physicianClusters.slice(0, 5);
        }

        topContainer.innerHTML = topStories.map(cluster => 
            this.renderStory(cluster, cluster._section)
        ).join('') || '<div class="loading">No medical stories available</div>';
    }

    renderEvidenceSection() {
        // Render evidence articles only in medical section
        const containers = [
            'evidenceArticlesMedical'     // medical only
        ];

        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) return;

            if (!this.evidenceData || !this.evidenceData.articles || this.evidenceData.articles.length === 0) {
                container.innerHTML = '<div class="loading">No evidence articles available</div>';
                return;
            }

            // Show articles from last 7 days, sorted by recency
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const articles = this.evidenceData.articles
                .filter(article => new Date(article.dateReceived) >= sevenDaysAgo)
                .sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived))
                .reverse() // Show articles in reverse order (newest RSS entries first)
                .slice(0, 15); // Cap at reasonable limit for UI performance
            
            container.innerHTML = articles.map(article => 
                this.renderEvidenceArticle(article)
            ).join('');
        });
    }

    renderEvidenceArticle(article) {
        const timeAgo = this.formatTimeAgo(article.dateReceived);
        const isNew = article.isNew ? 'new-badge' : '';
        
        // Create a short journal badge
        const journalBadge = this.getJournalBadge(article.journal);
        
        // Format tags for display with shortened names
        let tagsDisplay = '';
        if (article.tags && article.tags.length > 0) {
            const shortenedTags = article.tags.slice(0, 2).map(tag => {
                // Shorten common long specialty names
                if (tag === 'Family Medicine (FM)/General Practice (GP)') {
                    return 'Family Medicine';
                }
                return tag;
            });
            tagsDisplay = shortenedTags.join(', ') + (article.tags.length > 2 ? '...' : '');
        }

        return `
            <div class="evidence-article" onclick="openEvidenceModal('${article.id}')">
                <div class="evidence-meta">
                    <div class="evidence-journal">${journalBadge} ↗</div>
                    <div class="evidence-score-time">
                        <span class="evidence-score">${article.score}</span>
                        <span>•</span>
                        <span class="evidence-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="evidence-content">
                    <div class="evidence-title">
                        ${this.escapeHtml(article.title)}
                    </div>
                </div>
            </div>
        `;
    }

    getJournalBadge(journal) {
        // Create short badges for common journals
        const journalMap = {
            'JAMA': 'JAMA',
            'N Engl J Med': 'NEJM',
            'The Lancet': 'Lancet',
            'Eur Heart J': 'EHJ',
            'J Thromb Haemost': 'JTH',
            'Ann Emerg Med': 'AEM',
            'BJOG': 'BJOG'
        };
        
        return journalMap[journal] || journal.substring(0, 6);
    }

    renderStory(cluster, section = 'global') {
        const timeAgo = this.formatTimeAgo(cluster.updated_at);
        
        return `
            <div class="news-story" onclick="openModal('${section}_${cluster.id}')">
                <div class="story-meta">
                    <div class="source-count">${cluster.coverage} SOURCE${cluster.coverage > 1 ? 'S' : ''} ↗</div>
                    <div class="story-time">${timeAgo}</div>
                </div>
                <div class="story-content">
                    <div class="story-title">${this.escapeHtml(cluster.neutral_headline || cluster.title)}</div>
                </div>
            </div>
        `;
    }

    getSourceNames(items) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return 'unknown source';
        }
        
        try {
            // Step 1: Map items to source names
            const mappedSources = items.map(item => {
                if (!item) return 'Unknown Source';
                
                // Always use the source field if available
                if (item.source) {
                    return item.source;
                }
                
                // Fallback to parsing URL if no source field
                if (item.url) {
                    try {
                        const url = new URL(item.url);
                        let hostname = url.hostname.replace(/^www\./, '');
                        // Map common news domains to friendly names
                        const sourceMap = {
                            'theguardian.com': 'The Guardian',
                            'bbc.com': 'BBC News',
                            'reuters.com': 'Reuters',
                            'nytimes.com': 'The New York Times',
                            'washingtonpost.com': 'The Washington Post',
                            'cnn.com': 'CNN',
                            'bloomberg.com': 'Bloomberg',
                            'ft.com': 'Financial Times',
                            'wsj.com': 'The Wall Street Journal',
                            'abc.net.au': 'ABC News',
                            'smh.com.au': 'Sydney Morning Herald',
                            'theage.com.au': 'The Age'
                        };
                        return sourceMap[hostname] || hostname;
                    } catch {
                        return 'Unknown Source';
                    }
                }
                
                return 'Unknown Source';
            });
            
            // Step 2: Remove duplicates with Set, then convert back to Array
            const uniqueSourcesSet = new Set(mappedSources);
            const uniqueSourcesArray = Array.from(uniqueSourcesSet);
            
            // Step 3: Filter out invalid values
            const sources = uniqueSourcesArray.filter(s => s && s !== 'undefined' && s !== 'Unknown Source');
            
            // Step 4: Format for display
            if (sources.length === 0) return 'various sources';
            if (sources.length === 1) return sources[0];
            if (sources.length === 2) return `${sources[0]} and ${sources[1]}`;
            return `${sources[0]}, ${sources[1]}, and others`;
            
        } catch (error) {
            console.error('Error in getSourceNames:', error, items);
            return 'unknown source';
        }
    }

    getTimeIndicatorClass(timestamp) {
        const now = Date.now();
        const storyTime = new Date(timestamp).getTime();
        const hoursDiff = (now - storyTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            return ''; // Green (default)
        } else if (hoursDiff < 48) {
            return 'yellow';
        } else {
            return 'gray';
        }
    }

    isRecentStory(timestamp) {
        const now = Date.now();
        const storyTime = new Date(timestamp).getTime();
        const hoursDiff = (now - storyTime) / (1000 * 60 * 60);
        return hoursDiff < 24;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const then = new Date(timestamp).getTime();
        const diff = now - then;
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (minutes < 60) return `${minutes} Min Ago`;
        if (hours < 24) return `${hours} Min Ago`; // Using Min for hours as per design
        return `${days} Min Ago`; // Using Min for days as per design
    }

    updateCurrentDateTime() {
        // Get current time in Sydney timezone
        const now = new Date();
        const sydneyTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        const dayName = dayNames[sydneyTime.getDay()];
        const day = sydneyTime.getDate();
        const month = monthNames[sydneyTime.getMonth()];
        
        // Get ordinal suffix
        const getOrdinalSuffix = (n) => {
            if (n >= 11 && n <= 13) return 'th';
            switch (n % 10) {
                case 1: return 'st';
                case 2: return 'nd';
                case 3: return 'rd';
                default: return 'th';
            }
        };
        
        // Format time as 12-hour with seconds
        const timeOptions = {
            timeZone: 'Australia/Sydney',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        const timeString = now.toLocaleString('en-AU', timeOptions).toUpperCase();
        
        // Update header date/time (left side)
        const dateElement = document.getElementById('currentDate');
        if (dateElement) {
            dateElement.innerHTML = `<strong>${dayName}</strong><br>${day} ${monthNames[sydneyTime.getMonth()]}<br>${timeString}`;
        }
    }

    updateLastUpdated() {
        const times = [];
        
        Object.values(this.newsData).forEach(data => {
            if (data.updated_at) {
                times.push(new Date(data.updated_at).getTime());
            } else if (data.metadata?.last_updated) {
                times.push(new Date(data.metadata.last_updated).getTime());
            } else if (data.clinical?.metadata?.last_updated) {
                times.push(new Date(data.clinical.metadata.last_updated).getTime());
            }
        });
        
        if (times.length > 0) {
            const mostRecent = new Date(Math.max(...times));
            const element = document.getElementById('lastRefresh');
            if (element) {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                   'July', 'August', 'September', 'October', 'November', 'December'];
                const hours = mostRecent.getHours();
                const minutes = mostRecent.getMinutes();
                const ampm = hours >= 12 ? 'pm' : 'am';
                const displayHours = hours % 12 || 12;
                const date = mostRecent.getDate();
                const month = monthNames[mostRecent.getMonth()];
                const year = mostRecent.getFullYear();
                
                // Determine edition based on time
                let edition = 'Night Edition';
                if (hours >= 5 && hours < 12) edition = 'Morning Edition';
                else if (hours >= 12 && hours < 17) edition = 'Midday Edition';
                else if (hours >= 17 && hours < 21) edition = 'Evening Edition';
                
                element.innerHTML = `<strong>Midday Ed.</strong><br>⟳ ${date}/${mostRecent.getMonth() + 1}<br>${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm.toUpperCase()}`;
            }
        }
    }

    async loadWeather() {
        try {
            // Check cache (15 minutes)
            const cacheAge = Date.now() - this.weatherCache.timestamp;
            if (this.weatherCache.data && cacheAge < 15 * 60 * 1000) {
                this.weatherData = this.weatherCache.data;
                this.renderWeatherSummary();
                return;
            }

            // Try to fetch real weather data
            try {
                const weatherResponse = await fetch(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/Sydney?unitGroup=metric&key=L9XCUZMS4TEUL2YBU8J8K2LBM&contentType=json`);

                if (weatherResponse.ok) {
                    const weatherData = await weatherResponse.json();
                    this.weatherData = {
                        current: weatherData.currentConditions,
                        today: weatherData.days[0], // This includes sunrise, sunset, sunriseEpoch, sunsetEpoch
                        hourly: weatherData.days[0].hours,
                        daily: weatherData.days
                    };

                    // Cache the data
                    this.weatherCache = {
                        timestamp: Date.now(),
                        data: this.weatherData
                    };

                    this.renderWeatherSummary();
                    return;
                }
            } catch (apiError) {
                console.log('Weather API not available, using dummy data');
            }

            // Use clear error indicators when API fails
            this.weatherData = {
                current: {
                    conditions: 'DATA UNAVAILABLE',
                    temp: null
                },
                today: {
                    tempmax: null,
                    tempmin: null
                },
                hourly: [],
                daily: []
            };

            this.renderWeatherSummary();
        } catch (error) {
            console.error('Weather loading failed:', error);
            const element = document.getElementById('weatherLine');
            if (element) {
                element.innerHTML = 'Overcast for<br>the rest of today ↗';
            }
        }
    }

    renderWeatherSummary() {
        if (!this.weatherData) return;

        const current = this.weatherData.current;
        const today = this.weatherData.today;
        
        // Get rest of day forecast
        const now = new Date();
        const currentHour = now.getHours();
        const restOfDayHours = this.weatherData.hourly.filter(hour => {
            const hourTime = parseInt(hour.datetime.split(':')[0]);
            return hourTime > currentHour;
        });
        
        const restOfDayCondition = restOfDayHours.length > 0 ? restOfDayHours[0].conditions : current.conditions;
        
        // Simplify weather condition descriptions
        const getSimpleCondition = (condition) => {
            const lower = condition.toLowerCase();
            if (lower.includes('rain')) return 'rain';
            if (lower.includes('cloud') || lower.includes('overcast')) return 'clouds';
            if (lower.includes('clear') || lower.includes('sun')) return 'sunshine';
            if (lower.includes('storm')) return 'storms';
            if (lower.includes('snow')) return 'snow';
            return condition;
        };
        
        const simpleCondition = getSimpleCondition(current.conditions);
        
        const element = document.getElementById('weatherLine');
        if (element) {
            element.innerHTML = `${restOfDayCondition} for<br>the rest of today ↗`;
        }
    }

    renderError(section, message) {
        const topContainer = document.getElementById(`${section}TopStories`);
        if (topContainer) {
            topContainer.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for onclick handlers
function toggleMedicalLens() {
    if (!window.newsApp) return;
    
    // Toggle the lens mode
    window.newsApp.medicalLensMode = window.newsApp.medicalLensMode === 'patient' ? 'physician' : 'patient';
    
    // Update UI elements
    const titleElement = document.getElementById('medicalTopStoriesTitle');
    const toggleButton = document.getElementById('medicalLensToggle');
    
    if (titleElement) {
        titleElement.textContent = window.newsApp.medicalLensMode === 'patient' 
            ? 'Top Stories - Patient Lens' 
            : 'Top Stories - Physician Lens';
    }
    
    if (toggleButton) {
        toggleButton.classList.toggle('physician', window.newsApp.medicalLensMode === 'physician');
    }
    
    // Update the medical top stories content
    const medicalData = window.newsApp.newsData.medical;
    if (medicalData) {
        window.newsApp.updateMedicalTopStories(medicalData);
    }
}

function switchTab(tab, event) {
    // Update active tab button
    document.querySelectorAll('.news-tab').forEach(button => {
        button.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Fallback: find and activate the correct tab button
        const tabButton = document.querySelector(`[onclick*="${tab}"]`);
        if (tabButton) tabButton.classList.add('active');
    }
    
    // Update active section
    document.querySelectorAll('.news-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(tab).classList.add('active');
    
    window.newsApp.currentTab = tab;
}

function openModal(clusterId) {
    const cluster = window.newsApp.clusterData[clusterId];
    if (!cluster) {
        console.error('Cluster not found:', clusterId);
        return;
    }
    
    // Populate modal content
    const modal = document.getElementById('newsModal');
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    // Update modal title
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.textContent = cluster.neutral_headline || cluster.title;
    }
    
    // Update image container
    const imageContainer = document.getElementById('modalImageContainer');
    let imageUrl = cluster.featured_image || cluster.image_url || cluster.image;
    
    if (imageContainer) {
        if (imageUrl) {
            imageContainer.innerHTML = `<img src="${imageUrl}" alt="Story image" class="modal-image" />`;
        } else {
            // Use a placeholder image for demo
            imageContainer.innerHTML = `<img src="https://via.placeholder.com/400x200/666666/ffffff?text=News+Image" alt="Story image" class="modal-image" />`;
        }
    }
    
    // Update brief content
    const briefContent = document.getElementById('modalBriefContent');
    let summaryPoints = null;

    if (cluster.ai_summary) {
        if (Array.isArray(cluster.ai_summary)) {
            summaryPoints = cluster.ai_summary;
        } else if (typeof cluster.ai_summary === 'string') {
            // Convert newline-separated string to array
            summaryPoints = cluster.ai_summary
                .split('\n')
                .map(line => line.replace(/^[•\-]\s*/, '').trim())
                .filter(line => line.length > 0);
        }
    }

    if (briefContent) {
        if (summaryPoints && summaryPoints.length > 0) {
            let briefHTML = '<ol>';
            summaryPoints.forEach((point) => {
                briefHTML += `<li>${window.newsApp.escapeHtml(point)}</li>`;
            });
            briefHTML += '</ol>';
            briefContent.innerHTML = briefHTML;
        } else {
            briefContent.innerHTML = '<p>This story may be too hard for me to put simply. Click through to the full article to learn more instead.</p>';
        }
    }
    
    // Update sources content
    const sourcesContent = document.getElementById('modalSourcesContent');
    const sourcesToggle = document.getElementById('sourcesToggle');
    
    if (sourcesContent) {
        if (cluster.items && cluster.items.length > 0) {
            let sourcesHTML = '';
            cluster.items.forEach(item => {
                sourcesHTML += `
                    <div class="source-item">
                        <div class="source-title">${window.newsApp.escapeHtml(item.title || cluster.title)}</div>
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="source-link">${window.newsApp.escapeHtml(item.source || 'Unknown Source')} ↗</a>
                    </div>
                `;
            });
            sourcesContent.innerHTML = sourcesHTML;
        } else {
            sourcesContent.innerHTML = '<div class="source-item"><div class="source-title">No sources available</div><div class="source-link">—</div></div>';
        }
        
        // Reset Sources section to collapsed state
        sourcesContent.classList.add('collapsed');
    }
    
    if (sourcesToggle) {
        sourcesToggle.classList.add('collapsed');
    }
    
    // Show modal
    modal.classList.add('active');
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('newsModal');
    if (modal) {
        modal.classList.remove('active');
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

function closeNewsModal() {
    closeModal();
}

function toggleSources() {
    const sourcesContent = document.getElementById('modalSourcesContent');
    const sourcesToggle = document.getElementById('sourcesToggle');
    
    if (sourcesContent && sourcesToggle) {
        const isCollapsed = sourcesContent.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            sourcesContent.classList.remove('collapsed');
            sourcesToggle.classList.remove('collapsed');
        } else {
            // Collapse
            sourcesContent.classList.add('collapsed');
            sourcesToggle.classList.add('collapsed');
        }
    }
}

function openEvidenceModal(articleId) {
    if (!window.newsApp.evidenceData || !window.newsApp.evidenceData.articles) {
        console.error('Evidence data not available');
        return;
    }

    const article = window.newsApp.evidenceData.articles.find(a => a.id === articleId);
    if (!article) {
        console.error('Evidence article not found:', articleId);
        return;
    }

    // Get evidence modal elements
    const modal = document.getElementById('evidenceModal');
    const titleElement = document.getElementById('evidenceModalTitle');
    const doiElement = document.getElementById('evidenceDoiInfo');
    const pubmedButton = document.getElementById('evidencePubmedButton');
    const summaryContent = document.getElementById('evidenceSummaryContent');
    const abstractContent = document.getElementById('evidenceAbstractContent');
    
    if (!modal || !titleElement || !summaryContent || !abstractContent) {
        console.error('Evidence modal elements not found');
        return;
    }

    // Set title
    titleElement.textContent = article.title;
    
    // Set DOI info
    if (doiElement && (article.pubDate || article.doi)) {
        let doiText = '';
        if (article.pubDate) doiText += article.pubDate;
        if (article.doi) doiText += (doiText ? ' ' : '') + 'doi: ' + article.doi;
        doiElement.textContent = doiText;
    }

    // Set PubMed button
    if (pubmedButton && article.pubmedUrl) {
        pubmedButton.onclick = () => {
            window.open(article.pubmedUrl, '_blank', 'noopener,noreferrer');
        };
    } else if (pubmedButton) {
        pubmedButton.style.opacity = '0.5';
        pubmedButton.onclick = null;
    }

    // Set summary content
    if (article.summary) {
        summaryContent.textContent = article.summary;
    } else {
        summaryContent.textContent = 'Summary not available for this article.';
    }

    // Set abstract content
    if (article.abstract) {
        // Check if we have structured abstract data
        if (article.structuredAbstract && Array.isArray(article.structuredAbstract)) {
            let abstractHTML = '';
            
            article.structuredAbstract.forEach(section => {
                if (section.label && section.label.trim()) {
                    abstractHTML += `
                        <div class="abstract-section">
                            <h4 class="abstract-section-title">${window.newsApp.escapeHtml(section.label)}</h4>
                            <p class="abstract-section-text">${window.newsApp.escapeHtml(section.text)}</p>
                        </div>
                    `;
                } else {
                    abstractHTML += `
                        <div class="abstract-section">
                            <p class="abstract-section-text">${window.newsApp.escapeHtml(section.text)}</p>
                        </div>
                    `;
                }
            });
            
            abstractContent.innerHTML = abstractHTML;
        } else {
            // Fallback to flat abstract display
            abstractContent.innerHTML = `
                <div class="abstract-text">
                    ${window.newsApp.escapeHtml(article.abstract)}
                </div>
            `;
        }
    } else {
        abstractContent.innerHTML = `
            <div class="abstract-text">
                Abstract not available. Click the PubMed button to view the full article.
            </div>
        `;
    }

    // Ensure abstract is expanded by default
    const abstractToggle = document.getElementById('abstractToggle');
    if (abstractToggle) {
        abstractToggle.classList.remove('collapsed');
        abstractContent.classList.remove('collapsed');
    }

    // Show modal
    modal.classList.add('active');
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

function closeEvidenceModal() {
    const modal = document.getElementById('evidenceModal');
    if (modal) {
        modal.classList.remove('active');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

function toggleAbstract() {
    const abstractContent = document.getElementById('evidenceAbstractContent');
    const abstractToggle = document.getElementById('abstractToggle');
    
    if (abstractContent && abstractToggle) {
        const isCollapsed = abstractContent.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            abstractContent.classList.remove('collapsed');
            abstractToggle.classList.remove('collapsed');
        } else {
            // Collapse
            abstractContent.classList.add('collapsed');
            abstractToggle.classList.add('collapsed');
        }
    }
}

function openWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        populateWeatherModal();
        setupSimpleScrollIndicator();
    }
}

function setupSimpleScrollIndicator() {
    const modal = document.getElementById('weatherModal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.modal-content');
    const indicator = modal.querySelector('.weather-scroll-indicator');
    
    if (!modalContent || !indicator) return;
    
    // Only set up on mobile
    if (window.innerWidth <= 768) {
        // Show indicator initially
        indicator.style.display = 'flex';
        
        // Hide indicator on any scroll
        modalContent.addEventListener('scroll', () => {
            indicator.style.display = 'none';
        }, { once: true }); // Only fire once
    }
}

function populateWeatherModal() {
    // Use the weatherData from newsApp if available
    const weatherData = window.newsApp?.weatherData;
    
    if (!weatherData) {
        // Use clear error indicators if no data available
        const errorData = {
            current: { temp: null, conditions: 'DATA UNAVAILABLE' },
            today: { tempmax: null, tempmin: null },
            hourly: [],
            daily: []
        };
        updateWeatherModalContent(errorData);
    } else {
        updateWeatherModalContent(weatherData);
    }
}

function updateWeatherModalContent(data) {
    // Update current temperatures with appropriate colors
    const maxTemp = document.querySelector('.weather-temps .weather-temp-value');
    const nowTemp = document.querySelector('.weather-temp-now .weather-temp-value');
    const minTemp = document.querySelectorAll('.weather-temps .weather-temp-value')[2];
    
    if (maxTemp) {
        maxTemp.textContent = data.today?.tempmax != null ? `${Math.round(data.today.tempmax)}°C` : '-';
        maxTemp.style.color = '#ff3f00'; // Orange for max temp
    }
    if (nowTemp) {
        nowTemp.textContent = data.current?.temp != null ? `${Math.round(data.current.temp)}°C` : '-';
        nowTemp.style.color = '#ffffff'; // White (neutral) for current temp
    }
    if (minTemp) {
        minTemp.textContent = data.today?.tempmin != null ? `${Math.round(data.today.tempmin)}°C` : '-';
        minTemp.style.color = '#0077ff'; // Blue for min temp
    }
    
    // Update conditions
    const conditionValue = document.querySelector('.weather-condition-value');
    if (conditionValue) {
        conditionValue.textContent = (data.current?.conditions || 'PARTLY CLOUDY').toUpperCase();
    }
    
    // Update sun times with actual data
    const sunValues = document.querySelectorAll('.weather-sun-value');
    if (sunValues.length >= 3) {
        // Visual Crossing API provides sunrise and sunset in the today object
        if (data.today?.sunrise && data.today?.sunset) {
            // Format times from API (usually in HH:MM:SS format)
            const formatTime = (timeStr) => {
                if (!timeStr) return '-';
                // Extract HH:MM from HH:MM:SS format
                const parts = timeStr.split(':');
                if (parts.length >= 2) {
                    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
                }
                return timeStr;
            };
            
            // Calculate golden hour as approximately 1 hour after sunrise
            const calculateGoldenHour = (sunriseStr) => {
                if (!sunriseStr) return '-';
                const parts = sunriseStr.split(':');
                if (parts.length >= 2) {
                    let hour = parseInt(parts[0]) + 1;
                    const minute = parts[1];
                    if (hour > 23) hour = 0;
                    return `${hour.toString().padStart(2, '0')}:${minute}`;
                }
                return '-';
            };
            
            sunValues[0].textContent = formatTime(data.today.sunrise);
            sunValues[1].textContent = calculateGoldenHour(data.today.sunrise);
            sunValues[2].textContent = formatTime(data.today.sunset);
        } else {
            // No API data available - show clear indicators
            sunValues[0].textContent = '-';
            sunValues[1].textContent = '-';
            sunValues[2].textContent = '-';
        }
    }
    
    // Update rain chart with dynamic SVG masking and line overlay
    const chartPath = document.querySelector('.weather-chart-path');
    const maskElement = document.querySelector('#barMask');
    const chartTimes = document.querySelectorAll('.weather-chart-time');
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
    if (maskElement && chartPath) {
        let precipData = [];
        let hourLabels = [];
        
        // Calculate L1 based on your logic: current hour if MM<30, current+1 if MM>=30
        const currentMinutes = currentTime.getMinutes();
        const L1_hour = currentMinutes < 30 ? currentHour : currentHour + 1;
        
        // Generate 5 labels: L1, L1+1, L1+2, L1+3, L1+4
        for (let i = 0; i < 5; i++) {
            const labelHour24 = (L1_hour + i) % 24;
            
            // Convert to 12-hour format with AM/PM
            let displayHour = labelHour24 === 0 ? 12 : labelHour24 > 12 ? labelHour24 - 12 : labelHour24;
            const ampm = labelHour24 < 12 ? 'AM' : 'PM';
            hourLabels.push(`${displayHour}${ampm}`);
            
            // Get precipitation data for this hour
            if (data.hourly && data.hourly[L1_hour + i] && data.hourly[L1_hour + i].precipprob != null) {
                precipData.push(data.hourly[L1_hour + i].precipprob);
            } else {
                // No data available - use 0 to show flat line
                precipData.push(0);
            }
        }
        
        // Update time labels and add precipitation percentages directly above each
        chartTimes.forEach((timeElement, index) => {
            if (index < hourLabels.length) {
                timeElement.textContent = hourLabels[index];
                
                // Make this time element's container relative for absolute positioning
                timeElement.style.position = 'relative';
                timeElement.style.display = 'flex';
                timeElement.style.flexDirection = 'column';
                timeElement.style.alignItems = 'center';
                
                // Remove any existing precip label in this container
                const existingLabel = timeElement.querySelector('.weather-chart-precip');
                if (existingLabel) {
                    existingLabel.remove();
                }
                
                // Add precipitation percentage above this time label
                const precipPercentage = precipData[index] || 0;
                const precipLabel = document.createElement('div');
                precipLabel.className = 'weather-chart-precip';
                precipLabel.style.fontFamily = "'Zed Plex Mono', monospace";
                precipLabel.style.fontSize = '12px';
                precipLabel.style.color = '#5b5b5b';
                precipLabel.style.textAlign = 'center';
                precipLabel.style.marginBottom = '10px'; // Space between percentage and time
                precipLabel.textContent = `${Math.round(precipPercentage)}%`;
                
                // Insert the percentage before the time text
                timeElement.insertBefore(precipLabel, timeElement.firstChild);
            }
        });
        
        // Create SVG mask bars - no gaps between bars (5 bars for 5 hours)
        const barWidth = 100 / precipData.length;
        maskElement.innerHTML = precipData.map((value, index) => {
            const x = index * barWidth;
            const height = value;
            const y = 100 - height;
            return `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" fill="white" />`;
        }).join('');
        
        // Create SVG stroke line that traces the exact bar edges
        let pathData = '';
        
        // Start from bottom-left corner
        pathData += `M 0 100`;
        
        // Trace up to first bar height
        pathData += ` L 0 ${100 - precipData[0]}`;
        
        // Trace along the tops of all bars
        precipData.forEach((value, index) => {
            const x = index * barWidth;
            const nextX = (index + 1) * barWidth;
            const y = 100 - value;
            
            // Horizontal line across the top of this bar
            pathData += ` L ${nextX} ${y}`;
            
            // If there's a next bar, vertical line to its height
            if (index < precipData.length - 1) {
                const nextY = 100 - precipData[index + 1];
                pathData += ` L ${nextX} ${nextY}`;
            }
        });
        
        // Trace down to bottom-right corner
        pathData += ` L 100 100`;
        
        chartPath.setAttribute('d', pathData);
        chartPath.setAttribute('fill', 'none');
        chartPath.setAttribute('stroke', '#ff4000');
        chartPath.setAttribute('stroke-width', '2');
        chartPath.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    
    // Update rain summary
    const rainSummary = document.querySelector('.weather-rain-summary');
    if (rainSummary) {
        if (data.today && data.today.precipprob != null && data.today.precip != null) {
            const precipProb = Math.round(data.today.precipprob);
            const precipAmount = data.today.precip;
            rainSummary.innerHTML = `${precipProb}% CHANCE OF RAIN,<br>${precipAmount}MM TOTAL RAINFALL TODAY.`;
        } else {
            rainSummary.innerHTML = `- CHANCE OF RAIN,<br>- TOTAL RAINFALL TODAY.`;
        }
    }
    
    // Update 5-hour forecast
    const hourlyForecast = document.querySelectorAll('.weather-forecast-section')[0];
    if (hourlyForecast) {
        const forecastItems = hourlyForecast.querySelectorAll('.weather-forecast-item');
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinutes = currentTime.getMinutes();
        
        // Calculate starting hour (same logic as Raincast)
        const startHour = currentMinutes < 30 ? currentHour : currentHour + 1;
        
        forecastItems.forEach((item, index) => {
            if (index < 5) {
                const forecastHour = (startHour + index) % 24;
                
                // Update time label
                const timeLabel = item.querySelector('.weather-forecast-time');
                if (timeLabel) {
                    const displayHour = forecastHour === 0 ? 12 : forecastHour > 12 ? forecastHour - 12 : forecastHour;
                    const ampm = forecastHour < 12 ? 'AM' : 'PM';
                    timeLabel.textContent = `${displayHour}${ampm}`;
                }
                
                // Update weather data if available
                if (data.hourly && data.hourly[forecastHour]) {
                    const hourData = data.hourly[forecastHour];
                    const condition = item.querySelector('.weather-forecast-condition');
                    const temps = item.querySelector('.weather-forecast-temps');
                    const rain = item.querySelector('.weather-forecast-rain');
                    
                    if (condition) {
                        condition.textContent = hourData.conditions ? hourData.conditions.toUpperCase() : 'N/A';
                    }
                    if (temps) {
                        // Show single hourly temperature with color based on trend
                        if (hourData.temp != null) {
                            const currentTemp = Math.round(hourData.temp);
                            
                            // Get previous hour's temperature and color to determine trend
                            const prevHourIndex = forecastHour - 1 >= 0 ? forecastHour - 1 : 23;
                            const prevHourData = data.hourly[prevHourIndex];
                            
                            let tempClass = '';
                            if (prevHourData && prevHourData.temp != null) {
                                if (hourData.temp > prevHourData.temp) {
                                    // Temperature rising - use orange
                                    tempClass = 'temp-high';
                                } else if (hourData.temp < prevHourData.temp) {
                                    // Temperature falling - use blue
                                    tempClass = 'temp-low';
                                } else {
                                    // Temperature unchanged - get the previous item's color to maintain trend
                                    const prevItem = forecastItems[index - 1];
                                    if (prevItem) {
                                        const prevTempSpan = prevItem.querySelector('.weather-forecast-temps span');
                                        if (prevTempSpan) {
                                            if (prevTempSpan.classList.contains('temp-high')) {
                                                tempClass = 'temp-high';
                                            } else if (prevTempSpan.classList.contains('temp-low')) {
                                                tempClass = 'temp-low';
                                            }
                                        }
                                    }
                                }
                            }
                            
                            temps.innerHTML = `<span class="${tempClass}">${currentTemp}°C</span>`;
                        } else {
                            temps.innerHTML = `<span>-</span>`;
                        }
                    }
                    // Rain percentages removed - now shown in Raincast graph
                } else {
                    // No data available - show clear indicators
                    const condition = item.querySelector('.weather-forecast-condition');
                    const temps = item.querySelector('.weather-forecast-temps');
                    const rain = item.querySelector('.weather-forecast-rain');
                    
                    if (condition) condition.textContent = 'N/A';
                    if (temps) temps.innerHTML = `<span>-</span>`;
                    // Rain percentages removed - now shown in Raincast graph
                }
            }
        });
    }
    
    // Update 5-day forecast
    const dailyForecast = document.querySelectorAll('.weather-forecast-section')[1];
    if (dailyForecast) {
        const forecastItems = dailyForecast.querySelectorAll('.weather-forecast-item');
        
        // Generate dynamic day labels: TMR for tomorrow, then actual day names
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const today = new Date();
        const days = [];
        
        for (let i = 0; i < 5; i++) {
            if (i === 0) {
                // First slot is always "TMR"
                days.push('TMR');
            } else {
                // Calculate the actual day name for future dates
                const futureDate = new Date(today);
                futureDate.setDate(today.getDate() + i + 1); // +1 because we start from tomorrow
                days.push(dayNames[futureDate.getDay()]);
            }
        }
        
        forecastItems.forEach((item, index) => {
            if (index < 5) {
                // Update day label
                const timeLabel = item.querySelector('.weather-forecast-time');
                if (timeLabel) {
                    timeLabel.textContent = days[index];
                }
                
                // Update weather data if available
                if (data.daily && data.daily[index + 1]) { // Skip today, start from tomorrow
                    const dayData = data.daily[index + 1];
                    const condition = item.querySelector('.weather-forecast-condition');
                    const temps = item.querySelector('.weather-forecast-temps');
                    const rain = item.querySelector('.weather-forecast-rain');
                    
                    if (condition) {
                        condition.textContent = dayData.conditions ? dayData.conditions.toUpperCase() : 'N/A';
                    }
                    if (temps) {
                        if (dayData.tempmin != null && dayData.tempmax != null) {
                            const low = Math.round(dayData.tempmin);
                            const high = Math.round(dayData.tempmax);
                            temps.innerHTML = `<span class="temp-low">${low}</span> — <span class="temp-high">${high}</span>`;
                        } else {
                            temps.innerHTML = `<span class="temp-low">-</span> — <span class="temp-high">-</span>`;
                        }
                    }
                    if (rain) {
                        rain.textContent = dayData.precipprob != null ? `⛆ ${Math.round(dayData.precipprob)}%` : '⛆ -';
                    }
                } else {
                    // No data available - show clear indicators
                    const condition = item.querySelector('.weather-forecast-condition');
                    const temps = item.querySelector('.weather-forecast-temps');
                    const rain = item.querySelector('.weather-forecast-rain');
                    
                    if (condition) condition.textContent = 'N/A';
                    if (temps) temps.innerHTML = `<span class="temp-low">-</span> — <span class="temp-high">-</span>`;
                    if (rain) rain.textContent = '⛆ -';
                }
            }
        });
    }
}

function closeWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Reset indicator state when modal closes
        const indicator = modal.querySelector('.weather-scroll-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    const newsModal = document.getElementById('newsModal');
    const weatherModal = document.getElementById('weatherModal');
    const evidenceModal = document.getElementById('evidenceModal');
    
    if (e.target === newsModal) {
        closeModal();
    }
    
    if (e.target === weatherModal) {
        closeWeatherModal();
    }
    
    if (e.target === evidenceModal) {
        closeEvidenceModal();
    }
});

// Close modals with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeWeatherModal();
        closeEvidenceModal();
    }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.newsApp = new NewsApp();
});