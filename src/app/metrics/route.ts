import { renderMetrics } from "@/server/infrastructure/metrics";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(renderMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
