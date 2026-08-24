const requestCounts = new Map<string, number>();
const durationBuckets = [50, 100, 250, 500, 1000, 2500, 5000, Infinity];
const durationCounts = new Map<number, number>();
let requestTotal = 0;
let durationSum = 0;

for (const bucket of durationBuckets) durationCounts.set(bucket, 0);

function label(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function recordHttpRequest(path: string, status: number, durationMs: number) {
  const key = `${path}\u0000${status}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);
  requestTotal += 1;
  durationSum += durationMs;
  const bucket = durationBuckets.find((candidate) => durationMs <= candidate) || Infinity;
  durationCounts.set(bucket, (durationCounts.get(bucket) || 0) + 1);
}

export function renderMetrics() {
  const lines = [
    "# HELP outrank_http_requests_total Completed HTTP requests.",
    "# TYPE outrank_http_requests_total counter",
  ];
  for (const [key, count] of requestCounts) {
    const [path, status] = key.split("\u0000");
    lines.push(`outrank_http_requests_total{path="${label(path)}",status="${status}"} ${count}`);
  }

  lines.push("# HELP outrank_http_request_duration_ms Request duration in milliseconds.");
  lines.push("# TYPE outrank_http_request_duration_ms histogram");
  let cumulative = 0;
  for (const bucket of durationBuckets) {
    cumulative += durationCounts.get(bucket) || 0;
    lines.push(`outrank_http_request_duration_ms_bucket{le="${bucket === Infinity ? "+Inf" : bucket}"} ${cumulative}`);
  }
  lines.push(`outrank_http_request_duration_ms_sum ${durationSum}`);
  lines.push(`outrank_http_request_duration_ms_count ${requestTotal}`);
  lines.push("# HELP outrank_process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE outrank_process_uptime_seconds gauge");
  lines.push(`outrank_process_uptime_seconds ${process.uptime()}`);
  return `${lines.join("\n")}\n`;
}
