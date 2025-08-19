interface QueuedRequest {
  request: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  priority: number;
}

interface RetryableError extends Error {
  status?: number;
  retryAfter?: number;
}

export class RateLimitedQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private readonly maxConcurrent: number;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private lastRequestTime = 0;
  private readonly minInterval: number; // Minimum time between requests (ms)

  constructor(options: {
    maxConcurrent?: number;
    maxRetries?: number;
    baseDelay?: number;
    minInterval?: number;
  } = {}) {
    this.maxConcurrent = options.maxConcurrent || 8;
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000; // 1 second base delay
    this.minInterval = options.minInterval || 100; // 100ms between requests
  }

  async enqueue<T>(
    request: () => Promise<T>, 
    priority: number = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        request,
        resolve,
        reject,
        retryCount: 0,
        priority
      };

      // Insert based on priority (higher priority first)
      const insertIndex = this.queue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(queuedRequest);
      } else {
        this.queue.splice(insertIndex, 0, queuedRequest);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const queuedRequest = this.queue.shift();
    if (!queuedRequest) return;

    this.activeRequests++;

    try {
      // Respect minimum interval between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastRequest);
      }

      this.lastRequestTime = Date.now();
      const result = await queuedRequest.request();
      queuedRequest.resolve(result);
    } catch (error) {
      await this.handleError(queuedRequest, error as RetryableError);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  private async handleError(
    queuedRequest: QueuedRequest, 
    error: RetryableError
  ): Promise<void> {
    const shouldRetry = this.shouldRetry(error, queuedRequest.retryCount);
    
    if (shouldRetry && queuedRequest.retryCount < this.maxRetries) {
      queuedRequest.retryCount++;
      
      // Calculate delay with jittered exponential backoff
      // Pass the error status for special handling
      const delay = this.calculateRetryDelay(
        queuedRequest.retryCount, 
        error.retryAfter,
        error.status
      );
      
      console.log(`Retrying request (attempt ${queuedRequest.retryCount}/${this.maxRetries}) after ${delay}ms - Status: ${error.status}`);
      
      // Wait and re-queue with higher priority
      setTimeout(() => {
        queuedRequest.priority += 1000; // Boost priority for retries
        const insertIndex = this.queue.findIndex(item => item.priority < queuedRequest.priority);
        if (insertIndex === -1) {
          this.queue.push(queuedRequest);
        } else {
          this.queue.splice(insertIndex, 0, queuedRequest);
        }
        this.processQueue();
      }, delay);
    } else {
      queuedRequest.reject(error);
    }
  }

  private shouldRetry(error: RetryableError, retryCount: number): boolean {
    // Always retry on these status codes
    const retryableStatuses = [429, 502, 503, 504];
    
    // Network errors (no status)
    if (!error.status) {
      return retryCount < this.maxRetries;
    }
    
    // Special handling for 503 - could be overload or complexity
    if (error.status === 503) {
      // Log the specific error for debugging
      console.log(`503 error detected - likely model overload or complexity issue`);
      // Still retry but with longer backoff (handled in calculateRetryDelay)
      return retryCount < this.maxRetries;
    }
    
    return retryableStatuses.includes(error.status) && retryCount < this.maxRetries;
  }

  private calculateRetryDelay(retryCount: number, retryAfter?: number, status?: number): number {
    // If server provides Retry-After header, respect it
    if (retryAfter) {
      // Add some jitter to avoid thundering herd
      const jitter = Math.random() * 1000;
      return (retryAfter * 1000) + jitter;
    }

    // Special handling for 503 errors (model overload/complexity)
    // Use longer delays as these often need more time to recover
    if (status === 503) {
      const baseDelay503 = 5000; // 5 seconds base for 503
      const exponentialDelay = baseDelay503 * Math.pow(1.5, retryCount - 1); // Gentler curve
      const cappedDelay = Math.min(exponentialDelay, 60000); // Cap at 60 seconds for 503
      const jitter = cappedDelay * 0.3 * Math.random(); // 0-30% jitter
      return cappedDelay + jitter;
    }

    // Standard exponential backoff for other errors
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount - 1);
    
    // Cap at 30 seconds
    const cappedDelay = Math.min(exponentialDelay, 30000);
    
    // Add jitter: ±25% of the delay
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    
    return Math.max(100, cappedDelay + jitter); // Minimum 100ms
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue status for monitoring
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent
    };
  }

  // Wait for all requests to complete
  async drain(): Promise<void> {
    while (this.queue.length > 0 || this.activeRequests > 0) {
      await this.sleep(100);
    }
  }
}

// Singleton instance for Gemini API requests (optimized for Flash-Lite 30 RPM)
export const geminiQueue = new RateLimitedQueue({
  maxConcurrent: 5, // Can handle more concurrent with 30 RPM
  maxRetries: 4, // Reasonable retries
  baseDelay: 3000, // 3 second base delay for retries
  minInterval: 2100 // 2.1 seconds between requests (~28 RPM, safely under 30 RPM)
});