// Zod validation schemas for API request bodies.

import { z } from "zod";

export const submitContentSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().min(1).max(200),
  kind: z.enum([
    "movie", "show", "anime", "game", "song", "album",
    "creator", "post", "product", "website", "ai",
    "topic", "person", "moment",
  ]).optional(),
  category: z.enum([
    "global", "movies", "tv", "anime", "games", "music",
    "creators", "posts", "ai", "tech", "sport", "memes",
  ]).optional(),
  blurb: z.string().max(500).optional(),
  sub: z.string().max(200).optional(),
});

export const organicBoostSchema = z.object({
  contentId: z.string().min(1),
  amount: z.number().int().min(1).max(100),
});

export const sponsoredBidSchema = z.object({
  contentId: z.string().min(1),
  amount: z.number().int().min(100), // min $1.00 in cents
  currency: z.string().max(3).optional(),
  targetRank: z.number().int().min(1).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const reportContentSchema = z.object({
  contentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export type SubmitContentBody = z.infer<typeof submitContentSchema>;
export type OrganicBoostBody = z.infer<typeof organicBoostSchema>;
export type SponsoredBidBody = z.infer<typeof sponsoredBidSchema>;
export type ReportContentBody = z.infer<typeof reportContentSchema>;
