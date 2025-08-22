// Simple request queue implementation for rate limiting
class SimpleRequestQueue {
    constructor() {
        this.queue = [];
        this.running = false;
        this.lastRequestTime = 0;
        this.minInterval = 1000; // 1 second between requests
    }
    async enqueue(task, priority = 5) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject, priority });
            this.queue.sort((a, b) => b.priority - a.priority);
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.running || this.queue.length === 0) {
            return;
        }
        this.running = true;
        while (this.queue.length > 0) {
            const { task, resolve, reject } = this.queue.shift();
            try {
                // Rate limiting
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minInterval) {
                    await new Promise(res => setTimeout(res, this.minInterval - timeSinceLastRequest));
                }
                const result = await task();
                resolve(result);
                this.lastRequestTime = Date.now();
            }
            catch (error) {
                reject(error);
            }
        }
        this.running = false;
    }
}
const geminiQueue = new SimpleRequestQueue();
/**
 * Generate a one-sentence AI summary for an evidence article
 */
export async function generateEvidenceSummary(article) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn('GEMINI_API_KEY not provided, skipping summary generation');
        return undefined;
    }
    // Determine the best text to summarize
    let textToSummarize = '';
    if (article.structuredAbstract) {
        // Try to find conclusion section first
        const conclusionSection = article.structuredAbstract.find(section => section.label && section.label.toLowerCase().includes('conclusion'));
        if (conclusionSection) {
            textToSummarize = conclusionSection.text;
        }
        else {
            // Fall back to combining all structured abstract sections
            textToSummarize = article.structuredAbstract
                .map(section => section.text)
                .join(' ')
                .slice(0, 2000); // Limit length
        }
    }
    else if (article.abstract) {
        // Use the full abstract
        textToSummarize = article.abstract.slice(0, 2000); // Limit length
    }
    else {
        // No abstract available
        console.warn(`No abstract available for article: ${article.title}`);
        return undefined;
    }
    if (!textToSummarize.trim()) {
        return undefined;
    }
    const prompt = `Can I get a 1 sentence plain language but medical literate summary of this. Output just the conclusion without qualifying statements like "Based on the study provided".

Text to summarize:
${textToSummarize}

Summary:`;
    try {
        const response = await geminiQueue.enqueue(async () => {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                            parts: [{
                                    text: prompt
                                }]
                        }],
                    generationConfig: {
                        maxOutputTokens: 100, // Keep it concise for one sentence
                        temperature: 0.1
                    }
                })
            });
            if (!res.ok) {
                const error = new Error(`Gemini API error: ${res.status}`);
                error.status = res.status;
                throw error;
            }
            return res;
        }, 5);
        const result = await response.json();
        const summary = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        // Clean up the summary
        let cleanSummary = summary
            .replace(/^(Summary:|The summary is:|Here is the summary:)/gi, '') // Remove prefixes
            .replace(/^["']|["']$/g, '') // Remove quotes
            .trim();
        // Ensure it ends with a period if it doesn't already
        if (cleanSummary && !cleanSummary.match(/[.!?]$/)) {
            cleanSummary += '.';
        }
        return cleanSummary || undefined;
    }
    catch (error) {
        console.error(`Failed to generate summary for article "${article.title}":`, error);
        return undefined;
    }
}
/**
 * Generate summaries for multiple articles
 */
export async function generateBatchEvidenceSummaries(articles) {
    if (articles.length === 0)
        return;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.warn('GEMINI_API_KEY not provided, skipping summary generation');
        return;
    }
    console.log(`Generating summaries for ${articles.length} evidence articles...`);
    // Process articles one by one to avoid overwhelming the API
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        try {
            const summary = await generateEvidenceSummary(article);
            if (summary) {
                article.summary = summary;
                console.log(`✓ Generated summary for: ${article.title.slice(0, 50)}...`);
            }
            else {
                console.log(`⚠ No summary generated for: ${article.title.slice(0, 50)}...`);
            }
        }
        catch (error) {
            console.error(`✗ Failed to generate summary for: ${article.title.slice(0, 50)}...`, error);
        }
    }
    console.log('Summary generation complete');
}
