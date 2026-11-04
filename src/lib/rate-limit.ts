import { NextResponse } from "next/server";

/**
 * Best-effort per-IP limiter for the public demo, so a shared link can't run
 * up the API bill. In-memory, so it is per server instance — enough for a demo.
 */
const hits = new Map<string, number[]>();

export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60 * 60 * 1000): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    return NextResponse.json({ error: "Too many requests from this device — please try again later." }, { status: 429 });
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}
