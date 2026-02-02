import { promises as fs } from 'fs';
import path from 'path';

interface QuotaData {
  date: string; // YYYY-MM-DD in Pacific Time
  requests: number;
  lastReset: string; // ISO timestamp
}

export class QuotaTracker {
  private quotaFile: string;
  private maxDailyRequests: number;
  private quotaData: QuotaData | null = null;

  constructor(maxDailyRequests: number = 200) {
    this.maxDailyRequests = maxDailyRequests;
    this.quotaFile = path.join(process.cwd(), '.gemini-quota.json');
  }

  // Get current date in Pacific Time (where quota resets)
  private getPacificDate(): string {
    const now = new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    return pacific.toISOString().split('T')[0];
  }

  // Load quota data from file
  private async loadQuota(): Promise<QuotaData> {
    try {
      const data = await fs.readFile(this.quotaFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid, create new quota
      return {
        date: this.getPacificDate(),
        requests: 0,
        lastReset: new Date().toISOString()
      };
    }
  }

  // Save quota data to file
  private async saveQuota(data: QuotaData): Promise<void> {
    await fs.writeFile(this.quotaFile, JSON.stringify(data, null, 2));
  }

  // Check if we can make a request
  async canMakeRequest(): Promise<boolean> {
    const quota = await this.loadQuota();
    const currentDate = this.getPacificDate();

    // Reset quota if it's a new day
    if (quota.date !== currentDate) {
      quota.date = currentDate;
      quota.requests = 0;
      quota.lastReset = new Date().toISOString();
      await this.saveQuota(quota);
    }

    return quota.requests < this.maxDailyRequests;
  }

  // Increment request count
  async incrementRequests(count: number = 1): Promise<void> {
    const quota = await this.loadQuota();
    const currentDate = this.getPacificDate();

    // Reset if new day
    if (quota.date !== currentDate) {
      quota.date = currentDate;
      quota.requests = 0;
      quota.lastReset = new Date().toISOString();
    }

    quota.requests += count;
    await this.saveQuota(quota);
  }

  // Get remaining quota
  async getRemainingQuota(): Promise<number> {
    const quota = await this.loadQuota();
    const currentDate = this.getPacificDate();

    // Reset if new day
    if (quota.date !== currentDate) {
      return this.maxDailyRequests;
    }

    return Math.max(0, this.maxDailyRequests - quota.requests);
  }

  // Get quota status
  async getStatus(): Promise<{ used: number; remaining: number; total: number; resetsAt: string }> {
    const quota = await this.loadQuota();
    const currentDate = this.getPacificDate();

    // Reset if new day
    if (quota.date !== currentDate) {
      return {
        used: 0,
        remaining: this.maxDailyRequests,
        total: this.maxDailyRequests,
        resetsAt: this.getNextResetTime()
      };
    }

    return {
      used: quota.requests,
      remaining: Math.max(0, this.maxDailyRequests - quota.requests),
      total: this.maxDailyRequests,
      resetsAt: this.getNextResetTime()
    };
  }

  // Get next reset time (midnight Pacific)
  private getNextResetTime(): string {
    const now = new Date();
    const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    
    // Set to next midnight
    pacific.setDate(pacific.getDate() + 1);
    pacific.setHours(0, 0, 0, 0);
    
    return pacific.toISOString();
  }
}

// Singleton instance for Gemini 2.5 Flash-Lite (200 RPD)
export const geminiQuotaTracker = new QuotaTracker(200);
