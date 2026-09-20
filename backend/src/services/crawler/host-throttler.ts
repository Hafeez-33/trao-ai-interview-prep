export class HostThrottler {
  private readonly lastRequestTimes = new Map<string, number>();

  /**
   * Enforces a minimum delay between requests to the same hostname.
   */
  public async throttle(url: string, minDelayMs = 500): Promise<void> {
    if (minDelayMs <= 0) return;

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const now = Date.now();
      const lastTime = this.lastRequestTimes.get(hostname) || 0;
      const elapsed = now - lastTime;

      if (elapsed < minDelayMs) {
        const waitTime = minDelayMs - elapsed;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      this.lastRequestTimes.set(hostname, Date.now());
    } catch {
      // If URL parsing fails, proceed without throttling
    }
  }

  public reset(): void {
    this.lastRequestTimes.clear();
  }
}
