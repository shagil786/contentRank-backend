import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedis } from "../../src/server/infrastructure/redis";
import type {
  Entity,
  Category,
  ActivityEvent,
  LeaderState,
  BoostRequest,
  RankUpdatedEvent,
  AddEntityRequest,
} from "../../src/lib/outrank/types";
import { DAILY_HYPE } from "../../src/lib/outrank/types";
import { SEED_LOCATIONS } from "./seed";

// ---------------- HYDRATION FROM POSTGRESQL ----------------
// PostgreSQL is the source of truth. On boot we hydrate the in-memory cache
// (Redis-equivalent) from PostgreSQL via the Next.js app's leaderboard API.
// We RETRY until PostgreSQL is available — we never fall back to a static seed,
// because that would show fake data instead of real backend data.
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function hydrateFromPostgres(): Promise<Entity[]> {
  const MAX_RETRIES = 30;
  const RETRY_DELAY = 1000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`bad_status_${res.status}`);
      const data = (await res.json()) as LeaderState;
      if (data.entities && data.entities.length > 0) {
        console.log(`[hydrate] loaded ${data.entities.length} entities from PostgreSQL (attempt ${attempt})`);
        return data.entities;
      }
      throw new Error("empty");
    } catch (e) {
      console.log(`[hydrate] attempt ${attempt}/${MAX_RETRIES} failed: ${(e as Error).message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
  }
  console.error("[hydrate] FAILED after all retries — starting with empty state");
  return [];
}

// ---------------- STATE ----------------
let entities: Entity[] = []; // hydrated below
const activity: ActivityEvent[] = [];
let presence = 0;
let fighting = 0;
let totalBoosts = 0;

// session ledger: socketId -> { handle, location, sessionId } (no daily limit — paid model)
const ledgers = new Map<string, { handle: string; location: string; sessionId?: string }>();
const INSTANCE_ID = process.env.INSTANCE_ID || `realtime-${Math.random().toString(36).slice(2, 10)}`;
const SIMULATOR_LEASE_KEY = "outrank:realtime:simulator-leader";
let redisAdapterEnabled = false;

const HANDLES = ["anon", "ghost", "vega", "neon", "k9", "ruby", "echo", "halo", "zed", "milo", "noir", "pixel", "rune", "volt", "wren", "cyan", "onyx", "cobalt", "fenn", "jett"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function recalcRanks(scope: Entity[]) {
  // deterministic: score desc, createdAt asc (older wins ties)
  const sorted = [...scope].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  sorted.forEach((e, i) => {
    e.rank = i + 1;
  });
}

function recomputeAllRanks() {
  // global ranking across all entities
  recalcRanks(entities);
}

// ranks recomputed after hydration (see bottom of file)

function rankedForCategory(cat: Category): Entity[] {
  if (cat === "global") {
    return [...entities].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  }
  return [...entities]
    .filter((e) => e.category === cat)
    .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
}

function categoryOf(e: Entity): Category {
  return e.category;
}

// ---------------- TIME-DECAY ----------------
// Recent backing should matter more than old backing so the board continues to cycle.
interface TimedBoost { amount: number; ts: number }
const boostLog = new Map<string, TimedBoost[]>();
const pendingRankEvents = new Map<string, RankUpdatedEvent>();

// Keep boost acknowledgements immediate, but coalesce broadcast rank updates
// for the same entity into one event per 100 ms burst window.
setInterval(() => {
  for (const event of pendingRankEvents.values()) io.emit("rank.updated", event);
  pendingRankEvents.clear();
}, 100);

function decayFactor(boostTs: number, now = Date.now()): number {
  const ageHours = (now - boostTs) / (1000 * 60 * 60);
  if (ageHours <= 24) return 1;
  if (ageHours <= 168) return 1 - 0.5 * ((ageHours - 24) / 144);
  return 0.5;
}

function computeDecayedScore(entityId: string, now = Date.now()): number {
  return Math.round((boostLog.get(entityId) || []).reduce((sum, boost) => sum + boost.amount * decayFactor(boost.ts, now), 0));
}

function applyDecayAndRerank() {
  let changed = false;
  const now = Date.now();
  for (const entity of entities) {
    const score = computeDecayedScore(entity.id, now);
    if (score !== entity.score) { entity.score = score; changed = true; }
  }
  if (changed) { recomputeAllRanks(); io.emit("snapshot", { type: "snapshot", state: snapshot() } as const); }
}

setInterval(applyDecayAndRerank, 30_000);

// ---------------- BOOST (paid — USD, no daily limit) ----------------
function applyBoost(req: BoostRequest, socketId: string, isSim = false): { ok: boolean; reason?: string; ack?: any } {
  const e = entities.find((x) => x.id === req.entityId || x.slug === req.entityId);
  if (!e) return { ok: false, reason: "no_entity" };

  const amount = Math.max(1, Math.floor(req.amount)); // cents — no daily limit

  const boosts = boostLog.get(e.id) || [];
  boosts.push({ amount, ts: Date.now() });
  if (boosts.length > 200) boosts.shift();
  boostLog.set(e.id, boosts);

  const prevRank = e.rank;
  const prevScore = e.score;
  const prevGlobalRank = e.rank; // global rank stored on entity.rank

  e.score = computeDecayedScore(e.id);
  e.supporters += 1;

  // recompute global ranks (entities carry global rank on .rank)
  recomputeAllRanks();

  const newRank = e.rank;
  const newScore = e.score;
  if (newRank < e.peakRank) e.peakRank = newRank;
  // momentum: positions moved up since previous state
  const moved = prevRank - newRank;
  if (moved !== 0) e.momentum += moved;

  // push a history point (throttle to one per ~5s per entity via replacing last if close)
  const now = Date.now();
  const last = e.history[e.history.length - 1];
  if (last && now - last.t < 5000) {
    last.t = now;
    last.rank = newRank;
    last.score = newScore;
  } else {
    e.history.push({ t: now, rank: newRank, score: newScore });
    if (e.history.length > 48) e.history.shift();
  }

  // figure out displaced entities in GLOBAL scope (rows that changed rank)
  const displaced: { entityId: string; fromRank: number; toRank: number }[] = [];
  // simplest: any entity whose rank changed is displaced; we approximate by recomputing
  // We already mutated ranks globally; to find displaced, we'd need pre-state.
  // For the event, compute displaced as entities strictly between prevRank and newRank in global.
  if (newRank !== prevRank) {
    const lo = Math.min(prevRank, newRank);
    const hi = Math.max(prevRank, newRank);
    for (const o of entities) {
      if (o.id === e.id) continue;
      if (o.rank >= lo && o.rank <= hi) {
        displaced.push({ entityId: o.id, fromRank: o.rank + (newRank < prevRank ? -1 : 1) * 0, toRank: o.rank });
      }
    }
  }

  totalBoosts += 1;

  const handle = isSim ? pick(HANDLES) : ledgers.get(socketId)?.handle ?? "anon";
  const location = isSim ? pick(SEED_LOCATIONS) : ledgers.get(socketId)?.location ?? "—";

  // persist to PostgreSQL (source of truth) via the application layer.
  // fire-and-forget so the realtime UX stays instant; the write is audited there.
  if (!isSim) {
    const sessionId = ledgers.get(socketId)?.sessionId;
    if (sessionId) {
      fetch(`${API_BASE_URL}/api/boosts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Outrank-Session": sessionId,
          "X-Request-Id": `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
        body: JSON.stringify({ contentId: e.id, amount }),
      }).catch(() => {/* fire-and-forget; PG write best-effort */});
    }
  }

  const tookOne = prevRank !== 1 && newRank === 1;
  const defended = prevRank === 1 && newRank === 1;
  const evt: ActivityEvent = {
    id: Math.random().toString(36).slice(2, 10),
    type: tookOne ? "took_one" : defended ? "defended" : "boosted",
    entityId: e.id,
    entityName: e.name,
    category: categoryOf(e),
    amount,
    fromRank: prevRank,
    toRank: newRank,
    location,
    handle,
    ts: now,
  };
  activity.unshift(evt);
  if (activity.length > 200) activity.pop();

  const rankEvt: RankUpdatedEvent = {
    type: "rank.updated",
    entityId: e.id,
    category: categoryOf(e),
    prevRank,
    newRank,
    prevScore,
    newScore,
    displaced: displaced.slice(0, 12),
    ts: now,
  };

  const pending = pendingRankEvents.get(e.id);
  pendingRankEvents.set(e.id, pending ? {
    ...rankEvt,
    prevRank: pending.prevRank,
    prevScore: pending.prevScore,
    displaced: rankEvt.displaced,
  } : rankEvt);
  io.emit("activity.created", { type: "activity.created", event: evt } as const);

  // celebration overlay (balloons + firecrackers) for every real bid
  if (!isSim) {
    io.emit("bid.celebration", {
      type: "bid.celebration",
      entityName: e.name,
      amount,
      ts: now,
    } as const);
  }

  if (tookOne) {
    io.emit("leader.changed", {
      type: "leader.changed",
      category: "global",
      entityId: e.id,
      entityName: e.name,
      prevLeaderId: null,
    } as const);
  }

  return {
    ok: true,
    ack: { ok: true, entityId: e.id, newRank, prevRank, newScore },
  };
}

// ---------------- PREVIEW (rank projection without committing) ----------------
// Returns the projected rank after a boost, PLUS how much more hype is needed
// to reach the next rank up (so the UI can show "NEEDS +X TO REACH #N").
function previewBoost(entityId: string, amount: number): { newRank: number; prevRank: number; newScore: number; needed: number; nextRank: number; gapToNext: number } | null {
  const e = entities.find((x) => x.id === entityId || x.slug === entityId);
  if (!e) return null;
  const projectedScore = e.score + Math.max(1, Math.floor(amount));
  // count how many entities (global) would be strictly above projectedScore, or equal-but-newer
  let above = 0;
  for (const o of entities) {
    if (o.id === e.id) continue;
    if (o.score > projectedScore) above++;
    else if (o.score === projectedScore && o.createdAt < e.createdAt) above++;
  }
  const newRank = above + 1;

  // find the entity directly above (the one at rank newRank - 1 after boost)
  // and compute how much more hype is needed to overtake it
  const sorted = [...entities].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  const myProjectedIndex = sorted.findIndex((x) => x.id === e.id);
  let nextRank = newRank;
  let gapToNext = 0;
  if (myProjectedIndex > 0) {
    const aboveEntity = sorted[myProjectedIndex - 1];
    // need to beat aboveEntity.score (or equal + older, but we can't change createdAt)
    gapToNext = Math.max(0, aboveEntity.score - projectedScore + 1);
    nextRank = aboveEntity.rank;
  }
  return { newRank, prevRank: e.rank, newScore: projectedScore, needed: gapToNext, nextRank, gapToNext };
}

// ---------------- ADD ENTITY ----------------
// Persists to PostgreSQL via the application layer (/api/content), which goes
// through: URL registry → platform adapter → moderation → PostgreSQL → audit.
// Then adds the real PostgreSQL entity to the in-memory cache.
async function addEntity(req: AddEntityRequest, socketId: string): Promise<{ ok: boolean; entity?: Entity; reason?: string }> {
  if (!req.name?.trim()) return { ok: false, reason: "no_name" };
  const led = ledgers.get(socketId);

  // 1. persist to PostgreSQL via the application layer
  try {
    const apiRes = await fetch(`${API_BASE_URL}/api/content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Outrank-Session": led?.sessionId || "",
        "X-Request-Id": `rt-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
      body: JSON.stringify({
        title: req.name,
        kind: req.kind,
        category: req.category,
        sub: req.sub,
        blurb: req.blurb,
        url: req.link,
      }),
    });
    const apiData = await apiRes.json();
    if (!apiData.ok || !apiData.content) {
      return { ok: false, reason: apiData.reason || "api_failed" };
    }
    const content = apiData.content;

    // 2. build the Entity shape from the PostgreSQL Content
    const now = Date.now();
    const palHue = Math.floor(Math.random() * 360);
    const e: Entity = {
      id: content.id,
      slug: content.id,
      name: content.title.toUpperCase(),
      category: content.category,
      kind: content.kind,
      sub: content.blurb || content.sub || content.platform,
      blurb: content.description || content.blurb || "Newly added to the board.",
      link: content.url || req.link || undefined,
      image: content.imageUrl || req.image || undefined,
      score: 1000 + Math.floor(Math.random() * 800),
      supporters: 1,
      prevRank: entities.length + 1,
      rank: entities.length + 1,
      peakRank: entities.length + 1,
      momentum: 0,
      history: [{ t: now, rank: entities.length + 1, score: 1000 }],
      createdAt: new Date(content.createdAt).getTime(),
      poster: { hue: palHue, accent: "#ff3b1f", tag: String(content.kind).toUpperCase().slice(0, 4) },
    };
    entities.push(e);
    recomputeAllRanks();

    // 3. emit events
    const evt: ActivityEvent = {
      id: Math.random().toString(36).slice(2, 10),
      type: "added",
      entityId: e.id,
      entityName: e.name,
      category: e.category,
      amount: 0,
      fromRank: e.rank,
      toRank: e.rank,
      location: led?.location ?? "—",
      handle: led?.handle ?? "anon",
      ts: now,
    };
    activity.unshift(evt);
    if (activity.length > 200) activity.pop();
    io.emit("activity.created", { type: "activity.created", event: evt } as const);
    io.emit("entity.added", { type: "entity.added", entity: e } as const);
    return { ok: true, entity: e };
  } catch (err) {
    console.error("[addEntity] failed to persist to PostgreSQL:", err);
    return { ok: false, reason: "api_unreachable" };
  }
}

// ---------------- STATE SNAPSHOT ----------------
function snapshot(limit = 48, cursor = 0): LeaderState {
  const ranked = [...entities].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  const safeLimit = Math.min(48, Math.max(1, limit));
  const safeCursor = Math.max(0, cursor);
  return {
    entities: ranked.slice(safeCursor, safeCursor + safeLimit).map((e) => ({ ...e, history: e.history.slice(-24) })),
    activity: activity.slice(0, 60),
    presence,
    totalBoosts,
    ts: Date.now(),
    nextCursor: safeCursor + safeLimit < ranked.length ? String(safeCursor + safeLimit) : undefined,
    total: ranked.length,
  };
}

// ---------------- REST API (separate port, server-to-server; not via caddy) ----------------
// socket.io with path "/" claims all requests on its port, so REST lives on 3004.
const httpServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
  // socket.io handles its own paths; anything else 404s
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found_ws" }));
});

const restServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url?.startsWith("/state") && req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const limit = Number(u.searchParams.get("limit")) || 48;
    const cursor = Number(u.searchParams.get("cursor")) || 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot(limit, cursor)));
    return;
  }
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "outrank-realtime", instanceId: INSTANCE_ID, redisAdapter: redisAdapterEnabled, entities: entities.length }));
    return;
  }
  if (req.url === "/leaderboard" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot()));
    return;
  }
  if (req.url?.startsWith("/preview") && req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const id = u.searchParams.get("id") || "";
    const amt = parseInt(u.searchParams.get("amount") || "1", 10);
    const r = previewBoost(id, amt);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(r));
    return;
  }
  if (req.url === "/add" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body) as AddEntityRequest & { socketId?: string };
        const r = await addEntity(data, data.socketId || "http");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(r));
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, reason: "bad_json" }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end(JSON.stringify({ error: "not_found" }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const redisAdapterReady = (async () => {
  try {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    pubClient.on("error", () => {});
    subClient.on("error", () => {});
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    redisAdapterEnabled = true;
    console.log("[realtime] Redis Socket.IO adapter enabled");
  } catch {
    console.warn("[realtime] Redis unavailable; using local Socket.IO adapter");
  }
})();

// A short Redis lease prevents every realtime replica from generating its own
// synthetic traffic. The lease expires automatically if the leader crashes.
async function withSimulatorLease(run: () => void): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    run();
    return;
  }
  try {
    const acquired = await redis.set(SIMULATOR_LEASE_KEY, INSTANCE_ID, { NX: true, PX: 4_000 });
    if (acquired === "OK") run();
  } catch {
    // Preserve local development behavior if Redis temporarily disappears.
    run();
  }
}

io.on("connection", (socket) => {
  presence += 1;
  const handle = pick(HANDLES) + Math.floor(Math.random() * 90 + 10);
  const location = pick(SEED_LOCATIONS);
  ledgers.set(socket.id, { handle, location, sessionId: undefined });

  // create a PostgreSQL session via the application layer (best-effort, no auth)
  fetch(`${API_BASE_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, location }),
  }).then((r) => r.json()).then((data) => {
    if (data.sessionId) {
      const led = ledgers.get(socket.id);
      if (led) led.sessionId = data.sessionId;
    }
  }).catch(() => {/* best-effort */});

  socket.emit("snapshot", { type: "snapshot", state: snapshot() } as const);
  io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);

  socket.on("state.sync", (req: { since?: number }, ackFn?: (r: any) => void) => {
    const since = Number.isFinite(req?.since) ? Math.max(0, Number(req.since)) : 0;
    const missedActivity = activity.filter((event) => event.ts > since).slice(0, 60);
    ackFn?.({ type: "state.sync", state: snapshot(), missedActivity });
  });

  socket.on("boost", (req: BoostRequest) => {
    fighting += 1;
    io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);
    const r = applyBoost(req, socket.id, false);
    fighting = Math.max(0, fighting - 1);
    io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);
    socket.emit("boost.ack", { type: "boost.ack", ...r.ack, reason: r.reason, entityId: req.entityId } as const);
  });

  socket.on("preview", (req: { entityId: string; amount: number }, ackFn?: (r: any) => void) => {
    const r = previewBoost(req.entityId, req.amount);
    if (ackFn) ackFn(r);
  });

  socket.on("add", async (req: AddEntityRequest, ackFn?: (r: any) => void) => {
    const r = await addEntity(req, socket.id);
    if (ackFn) ackFn(r);
  });

  socket.on("set_handle", (h: { handle: string; location: string }) => {
    const led = ledgers.get(socket.id);
    if (led) {
      if (h.handle) led.handle = h.handle.slice(0, 24);
      if (h.location) led.location = h.location.toUpperCase().slice(0, 24);
    }
  });

  socket.on("disconnect", () => {
    presence = Math.max(0, presence - 1);
    ledgers.delete(socket.id);
    io.emit("presence.updated", { type: "presence.updated", count: presence, fighting } as const);
  });
});

// ---------------- AUTO SIMULATOR ----------------
// Keeps the board alive: random boosts every ~2.5–4.5s
function scheduleSim() {
  const delay = 2500 + Math.random() * 2000;
  setTimeout(() => {
    void withSimulatorLease(() => {
      // bias toward mid-board entities to create visible movement
      const pool = entities.filter((e) => e.rank > 1 && e.rank < entities.length);
      if (pool.length) {
        const e = pick(pool);
        const amt = 1 + Math.floor(Math.random() * Math.random() * 600);
        applyBoost({ entityId: e.id, amount: amt }, "sim", true);
      }
    });
    scheduleSim();
  }, delay);
}
scheduleSim();

// occasional bigger swings — target ranks 2..8 (exclude #1) so #1 is contestable
setInterval(() => {
  void withSimulatorLease(() => {
    const challengers = entities.filter((e) => e.rank >= 2 && e.rank <= 8);
    if (challengers.length) {
      const e = pick(challengers);
      const amt = 600 + Math.floor(Math.random() * 2600);
      applyBoost({ entityId: e.id, amount: amt }, "sim", true);
    }
  });
}, 9000);

const WSPORT = 3003;
const RESTPORT = 3004;

// hydrate from PostgreSQL (source of truth) on boot, then recompute ranks
// and start the sim + servers. If PostgreSQL is empty, falls back to static seed.
hydrateFromPostgres().then((hydrated) => {
  entities.push(...hydrated);
  const now = Date.now();
  for (const entity of entities) if (entity.score > 0) boostLog.set(entity.id, [{ amount: entity.score, ts: now }]);
  recomputeAllRanks();
  console.log(`[boot] ${entities.length} entities hydrated, ranks computed`);
}).catch((e) => {
  console.error("[boot] hydration failed, starting with empty state:", e);
}).finally(async () => {
  await redisAdapterReady;
  httpServer.listen(WSPORT, () => {
    console.log(`OUTRANK realtime socket.io on port ${WSPORT}`);
  });
  restServer.listen(RESTPORT, () => {
    console.log(`OUTRANK REST api on port ${RESTPORT}`);
  });
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
  restServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
  restServer.close(() => process.exit(0));
});
