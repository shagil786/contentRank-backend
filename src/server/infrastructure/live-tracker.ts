// In-memory live visitor tracker (Redis-shaped).
// In production this would use Redis. For the prototype, in-memory is fine.
// Google Analytics can be added client-side (gtag) — this gives the server
// its own real-time count for the "N WATCHING" display.

interface LiveStats {
  activeVisitors: number;
  totalPageViews: number;
  lastMinute: number[]; // timestamps of page views in the last minute
}

const stats: LiveStats = {
  activeVisitors: 0,
  totalPageViews: 0,
  lastMinute: [],
};

// sweep every 10s: remove timestamps older than 60s
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    stats.lastMinute = stats.lastMinute.filter((t) => now - t < 60_000);
  }, 10_000).unref?.();
}

export const liveTracker = {
  visitorEnter() {
    stats.activeVisitors += 1;
  },
  visitorLeave() {
    stats.activeVisitors = Math.max(0, stats.activeVisitors - 1);
  },
  pageView() {
    stats.totalPageViews += 1;
    stats.lastMinute.push(Date.now());
  },
  getStats() {
    return {
      activeVisitors: stats.activeVisitors,
      totalPageViews: stats.totalPageViews,
      viewsLastMinute: stats.lastMinute.length,
    };
  },
};
