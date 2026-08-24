import { logger } from "./logger";

/**
 * Central error-reporting seam. A Sentry transport can be attached here once
 * the deployment has a DSN; keeping the call site stable avoids scattered SDK
 * imports and prevents sensitive request bodies from being reported.
 */
export function captureServerError(
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  logger.error("error.captured", {
    event,
    ...context,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  });
}
