// Seed PostgreSQL with the cultural content, using the submitContent application
// service so every entry goes through the same flow (URL registry → adapter →
// moderation → PostgreSQL → metric job → ranking) as real submissions.
//
// Run: bun run src/server/seed.ts

import { submitContent } from "./application/submit-content";
import { newRequestContext } from "./infrastructure/request-context";
import { rankingRepo, contentRepo } from "./repositories/prisma-impl";
import type { Category, ContentKind } from "./domain/types";

interface Seed {
  name: string;
  category: Category;
  kind: ContentKind;
  sub: string;
  blurb: string;
  base: number;
  hue: number;
}

const SEEDS: Seed[] = [
  { name: "INTERSTELLAR", category: "movies", kind: "movie", sub: "2014 · Christopher Nolan", blurb: "A team travels through a wormhole in search of a new home for humanity.", base: 48291, hue: 220 },
  { name: "THE DARK KNIGHT", category: "movies", kind: "movie", sub: "2008 · Christopher Nolan", blurb: "Batman faces the Joker in a battle for Gotham's soul.", base: 39620, hue: 0 },
  { name: "DUNE: PART TWO", category: "movies", kind: "movie", sub: "2024 · Denis Villeneuve", blurb: "Paul Atreides unites with the Fremen to wage war on House Harkonnen.", base: 37110, hue: 42 },
  { name: "OPPENHEIMER", category: "movies", kind: "movie", sub: "2023 · Christopher Nolan", blurb: "The story of the father of the atomic bomb.", base: 33450, hue: 14 },
  { name: "BREAKING BAD", category: "tv", kind: "show", sub: "AMC · 2008–2013", blurb: "A chemistry teacher turns meth kingpin.", base: 42182, hue: 0 },
  { name: "SEVERANCE", category: "tv", kind: "show", sub: "Apple TV+ · 2022–", blurb: "Workers' minds are surgically split between work and home.", base: 36440, hue: 220 },
  { name: "ATTACK ON TITAN", category: "anime", kind: "anime", sub: "MAPPA · 2013–2023", blurb: "Humanity fights for survival against giant man-eating Titans.", base: 46903, hue: 14 },
  { name: "ARCANE", category: "anime", kind: "anime", sub: "Fortiche · 2021–2024", blurb: "Sisters torn apart by the conflict of Piltover and Zaun.", base: 41120, hue: 290 },
  { name: "GTA VI", category: "games", kind: "game", sub: "Rockstar · 2025", blurb: "The next chapter of the Grand Theft Auto universe.", base: 45100, hue: 180 },
  { name: "ELDEN RING", category: "games", kind: "game", sub: "FromSoftware · 2022", blurb: "Rise as the Tarnished and seek the Elden Ring.", base: 41900, hue: 42 },
  { name: "MRBEAST", category: "creators", kind: "creator", sub: "YouTube · @MrBeast", blurb: "Stunts, philanthropy, and spectacle at scale.", base: 51200, hue: 0 },
  { name: "CHATGPT", category: "ai", kind: "ai", sub: "OpenAI · 2022–", blurb: "The assistant that mainstreamed generative AI.", base: 45100, hue: 130 },
  { name: "CLAUDE", category: "ai", kind: "ai", sub: "Anthropic · 2023–", blurb: "The reasoning-focused assistant.", base: 39800, hue: 180 },
  { name: "THE TORTURED POETS DEPARTMENT", category: "music", kind: "album", sub: "Taylor Swift · 2024", blurb: "A double album of aftermath and ache.", base: 39200, hue: 0 },
  { name: "GNX", category: "music", kind: "album", sub: "Kendrick Lamar · 2024", blurb: "Surprise West Coast record.", base: 33400, hue: 14 },
  { name: "APPLE VISION PRO", category: "tech", kind: "product", sub: "Apple · 2024", blurb: "Spatial computing, first generation.", base: 27600, hue: 220 },
  { name: "SKIBIDI TOILET", category: "memes", kind: "topic", sub: "YouTube · 2023", blurb: "A surreal series that conquered Gen Alpha.", base: 24600, hue: 180 },
  { name: "SUPER BOWL OT", category: "sport", kind: "moment", sub: "NFL · 2024", blurb: "The first Super Bowl to go to overtime twice.", base: 30100, hue: 14 },
];

async function seed() {
  console.log("Seeding PostgreSQL via submitContent application service...");
  const ctx = newRequestContext({ actor: "system:seed" });
  let created = 0;
  for (const s of SEEDS) {
    // check if already exists (idempotent seed)
    const existing = await contentRepo.findByCanonicalId(`manual:${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-seed`);
    if (existing) {
      console.log(`  exists: ${s.name}`);
      continue;
    }
    const r = await submitContent(
      {
        title: s.name,
        kind: s.kind,
        category: s.category,
        sub: s.sub,
        blurb: s.blurb,
      },
      { ...ctx, requestId: `seed-${s.name}` }
    );
    if (r.ok && r.content) {
      // set initial score via a ranking snapshot
      await rankingRepo.appendOrganicSnapshot({
        contentId: r.content.id,
        category: "global",
        rank: 9999,
        score: s.base,
        momentum: 0,
      });
      await rankingRepo.appendOrganicSnapshot({
        contentId: r.content.id,
        category: s.category,
        rank: 9999,
        score: s.base,
        momentum: 0,
      });
      created++;
      console.log(`  + ${s.name} (${s.category}) score=${s.base}`);
    } else {
      console.log(`  FAIL ${s.name}: ${r.reason}`);
    }
  }
  console.log(`Done. Created ${created} entries.`);
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
