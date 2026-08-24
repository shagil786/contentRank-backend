// Detect the source platform from a URL, so we can label links as
// "OPEN ON INSTAGRAM →", "WATCH ON YOUTUBE →", etc. This drives traffic
// back to the creator's original content on their native platform.

export interface PlatformInfo {
  label: string;        // short label for badges: "IG", "YT", "SPOTIFY"
  openLabel: string;    // verb + platform: "OPEN ON INSTAGRAM", "WATCH ON YOUTUBE"
  host: string;         // pretty host: "instagram.com"
  color: string;        // brand-ish accent (kept muted to fit the palette)
}

export function detectPlatform(url?: string): PlatformInfo | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }

  const map: Record<string, Omit<PlatformInfo, "host">> = {
    "instagram.com": { label: "IG", openLabel: "OPEN ON INSTAGRAM", color: "#E1306C" },
    "youtube.com": { label: "YT", openLabel: "WATCH ON YOUTUBE", color: "#FF0000" },
    "youtu.be": { label: "YT", openLabel: "WATCH ON YOUTUBE", color: "#FF0000" },
    "tiktok.com": { label: "TT", openLabel: "WATCH ON TIKTOK", color: "#000000" },
    "x.com": { label: "X", openLabel: "OPEN ON X", color: "#000000" },
    "twitter.com": { label: "X", openLabel: "OPEN ON X", color: "#000000" },
    "threads.net": { label: "TH", openLabel: "OPEN ON THREADS", color: "#000000" },
    "reddit.com": { label: "R", openLabel: "OPEN ON REDDIT", color: "#FF4500" },
    "twitch.tv": { label: "TW", openLabel: "WATCH ON TWITCH", color: "#9146FF" },
    "spotify.com": { label: "♪", openLabel: "LISTEN ON SPOTIFY", color: "#1DB954" },
    "soundcloud.com": { label: "♪", openLabel: "LISTEN ON SOUNDCLOUD", color: "#FF5500" },
    "bandcamp.com": { label: "♪", openLabel: "LISTEN ON BANDCAMP", color: "#629AA9" },
    "music.apple.com": { label: "♪", openLabel: "LISTEN ON APPLE MUSIC", color: "#FA243C" },
    "open.spotify.com": { label: "♪", openLabel: "LISTEN ON SPOTIFY", color: "#1DB954" },
    "steampowered.com": { label: "STEAM", openLabel: "VIEW ON STEAM", color: "#1B2838" },
    "store.epicgames.com": { label: "EPIC", openLabel: "VIEW ON EPIC", color: "#2A2A2A" },
    "store.playstation.com": { label: "PS", openLabel: "VIEW ON PLAYSTATION", color: "#003791" },
    "imdb.com": { label: "IMDB", openLabel: "VIEW ON IMDB", color: "#F5C518" },
    "letterboxd.com": { label: "LB", openLabel: "VIEW ON LETTERBOXD", color: "#14181C" },
    "github.com": { label: "GH", openLabel: "VIEW ON GITHUB", color: "#181717" },
    "vercel.com": { label: "▲", openLabel: "VIEW ON VERCEL", color: "#000000" },
    "openai.com": { label: "AI", openLabel: "VISIT OPENAI", color: "#10A37F" },
    "anthropic.com": { label: "AI", openLabel: "VISIT ANTHROPIC", color: "#D97757" },
    "netflix.com": { label: "NF", openLabel: "WATCH ON NETFLIX", color: "#E50914" },
    "primevideo.com": { label: "PV", openLabel: "WATCH ON PRIME", color: "#00A8E1" },
    "disneyplus.com": { label: "D+", openLabel: "WATCH ON DISNEY+", color: "#113CCF" },
    "hbo.com": { label: "HBO", openLabel: "WATCH ON HBO", color: "#000000" },
    "max.com": { label: "MAX", openLabel: "WATCH ON MAX", color: "#002BE7" },
    "crunchyroll.com": { label: "CR", openLabel: "WATCH ON CRUNCHYROLL", color: "#F47521" },
    "myanimelist.net": { label: "MAL", openLabel: "VIEW ON MYANIMELIST", color: "#2E51A2" },
    "anilist.co": { label: "AL", openLabel: "VIEW ON ANILIST", color: "#02A9FF" },
  };

  for (const [key, val] of Object.entries(map)) {
    if (host === key || host.endsWith(`.${key}`)) {
      return { ...val, host };
    }
  }
  // generic fallback
  return { label: "↗", openLabel: "OPEN ORIGINAL", host };
}
