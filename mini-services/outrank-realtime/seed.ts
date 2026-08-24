import type { Entity, Category, EntityKind } from "../../src/lib/outrank/types";

// Deterministic generative poster palette per entity.
const PALETTES: { hue: number; accent: string; tag: string }[] = [
  { hue: 14, accent: "#ff3b1f", tag: "DRAM" },
  { hue: 42, accent: "#c9a227", tag: "EPIC" },
  { hue: 220, accent: "#1e3a8a", tag: "SCI-FI" },
  { hue: 0, accent: "#0a0a0a", tag: "NOIR" },
  { hue: 130, accent: "#1f7a3a", tag: "RAW" },
  { hue: 290, accent: "#6b21a8", tag: "MIND" },
  { hue: 180, accent: "#0e7490", tag: "CULT" },
  { hue: 0, accent: "#b3261e", tag: "HYPE" },
];

function p(i: number) {
  return PALETTES[i % PALETTES.length];
}

interface Seed {
  name: string;
  category: Category;
  kind: EntityKind;
  sub: string;
  blurb: string;
  base: number; // base score
  hue: number;
}

const SEEDS: Seed[] = [
  // MOVIES
  { name: "INTERSTELLAR", category: "movies", kind: "movie", sub: "2014 · Christopher Nolan", blurb: "A team travels through a wormhole in search of a new home for humanity.", base: 48291, hue: 220 },
  { name: "THE DARK KNIGHT", category: "movies", kind: "movie", sub: "2008 · Christopher Nolan", blurb: "Batman faces the Joker in a battle for Gotham's soul.", base: 39620, hue: 0 },
  { name: "DUNE: PART TWO", category: "movies", kind: "movie", sub: "2024 · Denis Villeneuve", blurb: "Paul Atreides unites with the Fremen to wage war on House Harkonnen.", base: 37110, hue: 42 },
  { name: "OPPENHEIMER", category: "movies", kind: "movie", sub: "2023 · Christopher Nolan", blurb: "The story of the father of the atomic bomb.", base: 33450, hue: 14 },
  { name: "BLADE RUNNER 2049", category: "movies", kind: "movie", sub: "2017 · Denis Villeneuve", blurb: "A new blade runner uncovers a long-buried secret.", base: 28940, hue: 180 },
  { name: "FIGHT CLUB", category: "movies", kind: "movie", sub: "1999 · David Fincher", blurb: "An insomniac office worker forms a fight club.", base: 27330, hue: 0 },
  { name: "INCEPTION", category: "movies", kind: "movie", sub: "2010 · Christopher Nolan", blurb: "A thief who steals corporate secrets through dream-sharing.", base: 26120, hue: 290 },
  { name: "THE MATRIX", category: "movies", kind: "movie", sub: "1999 · The Wachowskis", blurb: "A hacker learns the truth about his reality.", base: 22980, hue: 130 },

  // TV
  { name: "BREAKING BAD", category: "tv", kind: "show", sub: "AMC · 2008–2013", blurb: "A chemistry teacher turns meth kingpin.", base: 42182, hue: 0 },
  { name: "SEVERANCE", category: "tv", kind: "show", sub: "Apple TV+ · 2022–", blurb: "Workers' minds are surgically split between work and home.", base: 36440, hue: 220 },
  { name: "THE BOYS", category: "tv", kind: "show", sub: "Prime Video · 2019–", blurb: "Vigilantes take on corrupt superheroes.", base: 29870, hue: 14 },
  { name: "DARK", category: "tv", kind: "show", sub: "Netflix · 2017–2020", blurb: "A missing child uncovers four families' time-travel secret.", base: 24110, hue: 0 },
  { name: "BETTER CALL SAUL", category: "tv", kind: "show", sub: "AMC · 2015–2022", blurb: "The transformation of Jimmy McGill into Saul Goodman.", base: 21640, hue: 42 },
  { name: "GAME OF THRONES", category: "tv", kind: "show", sub: "HBO · 2011–2019", blurb: "Noble families vie for the Iron Throne.", base: 33200, hue: 14 },
  { name: "THE LAST OF US", category: "tv", kind: "show", sub: "HBO · 2023–", blurb: "A smuggler escorts a girl through a post-pandemic world.", base: 31200, hue: 130 },

  // ANIME
  { name: "ATTACK ON TITAN", category: "anime", kind: "anime", sub: "MAPPA · 2013–2023", blurb: "Humanity fights for survival against giant man-eating Titans.", base: 46903, hue: 14 },
  { name: "ARCANE", category: "anime", kind: "anime", sub: "Fortiche · 2021–2024", blurb: "Sisters torn apart by the conflict of Piltover and Zaun.", base: 41120, hue: 290 },
  { name: "DEMON SLAYER", category: "anime", kind: "anime", sub: "ufotable · 2019–", blurb: "A boy hunts demons to cure his sister.", base: 35200, hue: 14 },
  { name: "JUJUTSU KAISEN", category: "anime", kind: "anime", sub: "MAPPA · 2020–", blurb: "A student swallows a cursed finger and joins a secret society.", base: 31980, hue: 220 },
  { name: "ONE PIECE", category: "anime", kind: "anime", sub: "Toei · 1999–", blurb: "A rubber-bodied pirate seeks the legendary treasure.", base: 39990, hue: 42 },
  { name: "CHAINSAW MAN", category: "anime", kind: "anime", sub: "MAPPA · 2022", blurb: "A boy merged with a chainsaw devil hunts devils for hire.", base: 28770, hue: 0 },

  // GAMES
  { name: "GTA VI", category: "games", kind: "game", sub: "Rockstar · 2025", blurb: "The next chapter of the Grand Theft Auto universe.", base: 45100, hue: 180 },
  { name: "ELDEN RING", category: "games", kind: "game", sub: "FromSoftware · 2022", blurb: "Rise as the Tarnished and seek the Elden Ring.", base: 41900, hue: 42 },
  { name: "CYBERPUNK 2077", category: "games", kind: "game", sub: "CD Projekt Red · 2020", blurb: "A mercenary chases a one-of-a-kind implant in Night City.", base: 30120, hue: 290 },
  { name: "MINECRAFT", category: "games", kind: "game", sub: "Mojang · 2011", blurb: "Build, mine, and survive in an infinite block world.", base: 33500, hue: 130 },
  { name: "RED DEAD REDEMPTION 2", category: "games", kind: "game", sub: "Rockstar · 2018", blurb: "An outlaw rides the decline of the Wild West.", base: 36200, hue: 14 },
  { name: "BALDUR'S GATE 3", category: "games", kind: "game", sub: "Larian · 2023", blurb: "A party of adventurers battles a mind-flayer plague.", base: 34800, hue: 220 },

  // MUSIC
  { name: "BRAT", category: "music", kind: "album", sub: "Charli XCX · 2024", blurb: "The album that became an aesthetic.", base: 28800, hue: 130 },
  { name: "THE TORTURED POETS DEPARTMENT", category: "music", kind: "album", sub: "Taylor Swift · 2024", blurb: "A double album of aftermath and ache.", base: 39200, hue: 0 },
  { name: "GNX", category: "music", kind: "album", sub: "Kendrick Lamar · 2024", blurb: "Surprise West Coast record.", base: 33400, hue: 14 },
  { name: "HIT ME HARD AND SOFT", category: "music", kind: "album", sub: "Billie Eilish · 2024", blurb: "A dynamic third studio album.", base: 26100, hue: 180 },
  { name: "CHROMAKOPIA", category: "music", kind: "album", sub: "Tyler, The Creator · 2024", blurb: "A masked voyage into identity.", base: 30100, hue: 42 },
  { name: "ESCAPE", category: "music", kind: "song", sub: "RÜFÜS DU SOL · 2024", blurb: "Hypnotic electronic.", base: 14200, hue: 290 },

  // CREATORS
  { name: "MRBEAST", category: "creators", kind: "creator", sub: "YouTube · @MrBeast", blurb: "Stunts, philanthropy, and spectacle at scale.", base: 51200, hue: 0 },
  { name: "CASEY NEISTAT", category: "creators", kind: "creator", sub: "YouTube · @CaseyNeistat", blurb: "Daily vlog pioneer and filmmaker.", base: 18400, hue: 220 },
  { name: "MARQUES BROWNLEE", category: "creators", kind: "creator", sub: "YouTube · @MKBHD", blurb: "The standard for tech reviews.", base: 24700, hue: 130 },
  { name: "LIANA BRING", category: "creators", kind: "creator", sub: "TikTok · @lianabring", blurb: "Pop-culture commentary with bite.", base: 9800, hue: 290 },
  { name: "VALUETAINMENT", category: "creators", kind: "creator", sub: "YouTube · @Valuetainment", blurb: "Entrepreneurship and business breakdowns.", base: 12100, hue: 42 },

  // POSTS
  { name: "dune popcorn letterboxd", category: "posts", kind: "post", sub: "Letterboxd · review", blurb: "A single review that broke film twitter.", base: 7600, hue: 42 },
  { name: "zuckerberg surf photo", category: "posts", kind: "post", sub: "Instagram · 2020", blurb: "The most-ignored mascot of the pandemic.", base: 5400, hue: 220 },
  { name: "the dress", category: "posts", kind: "post", sub: "Tumblr · 2015", blurb: "Blue/black or white/gold? The original split.", base: 9100, hue: 290 },
  { name: "hogwarts legacy review", category: "posts", kind: "post", sub: "Reddit · r/gaming", blurb: "A megathread that shaped a launch.", base: 6300, hue: 130 },

  // AI
  { name: "CHATGPT", category: "ai", kind: "ai", sub: "OpenAI · 2022–", blurb: "The assistant that mainstreamed generative AI.", base: 45100, hue: 130 },
  { name: "CLAUDE", category: "ai", kind: "ai", sub: "Anthropic · 2023–", blurb: "The reasoning-focused assistant.", base: 39800, hue: 180 },
  { name: "GEMINI", category: "ai", kind: "ai", sub: "Google · 2023–", blurb: "Multimodal assistant across Google.", base: 28600, hue: 220 },
  { name: "CURSOR", category: "ai", kind: "ai", sub: "Anysphere · 2023–", blurb: "The AI-first code editor.", base: 33400, hue: 14 },
  { name: "GITHUB COPILOT", category: "ai", kind: "ai", sub: "GitHub · 2021–", blurb: "Autocomplete that grew into a pair-programmer.", base: 25200, hue: 290 },
  { name: "PERPLEXITY", category: "ai", kind: "ai", sub: "Perplexity · 2022–", blurb: "Answer engine with citations.", base: 22100, hue: 42 },
  { name: "SUNO", category: "ai", kind: "ai", sub: "Suno · 2023–", blurb: "Generate full songs from a prompt.", base: 18900, hue: 290 },

  // TECH
  { name: "APPLE VISION PRO", category: "tech", kind: "product", sub: "Apple · 2024", blurb: "Spatial computing, first generation.", base: 27600, hue: 220 },
  { name: "FRAMEWORK LAPTOP 16", category: "tech", kind: "product", sub: "Framework · 2024", blurb: "Modular, repairable, upgradeable.", base: 11400, hue: 130 },
  { name: "RABBIT R1", category: "tech", kind: "product", sub: "Rabbit · 2024", blurb: "A pocket AI companion.", base: 9800, hue: 290 },
  { name: "SUPABASE", category: "tech", kind: "website", sub: "supabase.com", blurb: "The open-source Firebase alternative.", base: 16800, hue: 130 },
  { name: "VERCEL", category: "tech", kind: "website", sub: "vercel.com", blurb: "The platform for frontend developers.", base: 19400, hue: 0 },

  // SPORT
  { name: "MESSI IN MIAMI", category: "sport", kind: "moment", sub: "Inter Miami · 2023–", blurb: "A new chapter in a generational career.", base: 26200, hue: 14 },
  { name: "MAX VERSTAPPEN RUN", category: "sport", kind: "moment", sub: "Formula 1 · 2023", blurb: "A record-breaking championship streak.", base: 22400, hue: 0 },
  { name: "SUPER BOWL OT", category: "sport", kind: "moment", sub: "NFL · 2024", blurb: "The first Super Bowl to go to overtime twice.", base: 30100, hue: 14 },
  { name: "WEMBY'S ROOKIE YEAR", category: "sport", kind: "moment", sub: "NBA · 2024", blurb: "An alien arrives and rewrites defense.", base: 18900, hue: 130 },

  // MEMES
  { name: "SKIBIDI TOILET", category: "memes", kind: "topic", sub: "YouTube · 2023", blurb: "A surreal series that conquered Gen Alpha.", base: 24600, hue: 180 },
  { name: "GALVANIZED SQUARE STEEL", category: "memes", kind: "topic", sub: "TikTok · 2024", blurb: "Meme-architecture from a Chinese ad format.", base: 14200, hue: 42 },
  { name: "HOVERBOARD KID", category: "memes", kind: "topic", sub: "Vine · 2015", blurb: "The fall that launched a million remixes.", base: 8800, hue: 290 },
  { name: "LOOK AT THIS GRAPH", category: "memes", kind: "topic", sub: "YouTube · 2009", blurb: "The yodel that refuses to die.", base: 7700, hue: 130 },
];

const LOCATIONS = ["BENGALURU", "NEW YORK", "TOKYO", "LONDON", "SEOUL", "BERLIN", "SAO PAULO", "MUMBAI", "TORONTO", "LAGOS", "PARIS", "MEXICO CITY", "AMSTERDAM", "SYDNEY", "DUBAI"];

export const SEED_LOCATIONS = LOCATIONS;

export function buildSeed(): Entity[] {
  const now = Date.now();
  return SEEDS.map((s, i) => {
    const id = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const createdAt = now - (SEEDS.length - i) * 3600_000 - Math.floor(Math.random() * 3_600_000);
    // small per-entity jitter so initial sort isn't exactly the input order
    const score = s.base + Math.floor((Math.sin(i * 9.13) + 1) * 1200) - 600;
    // build a synthetic 24h history (24 hourly points), drifting around current
    const history = [];
    for (let h = 23; h >= 0; h--) {
      const drift = Math.round(Math.sin(i * 3.7 + h) * (h * 6) + (Math.random() - 0.5) * 4);
      history.push({
        t: now - h * 3600_000,
        rank: Math.max(1, i + 1 + drift),
        score: Math.max(1000, score - (h * 120) + Math.round(Math.sin(i + h) * 200)),
      });
    }
    return {
      id,
      slug: id,
      name: s.name,
      category: s.category,
      kind: s.kind,
      sub: s.sub,
      blurb: s.blurb,
      score,
      supporters: Math.floor(2000 + Math.sin(i * 2.1) * 1800 + score / 18),
      prevRank: i + 1,
      rank: i + 1,
      peakRank: Math.max(1, Math.floor((i % 7) + 1)),
      momentum: Math.round((Math.sin(i * 1.7) * 14)),
      history,
      createdAt,
      poster: p(i),
    } as Entity;
  });
}
