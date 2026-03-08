import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { createRateLimiter, getIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const IS_DEV = process.env.NODE_ENV === "development";
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

// 20 parses per IP per minute — generous for real use, discourages abuse
const limiter = createRateLimiter(60_000, 20);

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed, retryAfter } = limiter(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 413 },
    );
  }

  const pdfBytes = Buffer.from(await req.arrayBuffer());

  if (pdfBytes.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 413 },
    );
  }

  return new Promise<NextResponse>((resolve) => {
    const scriptPath = path.join(process.cwd(), "api", "parse_bill.py");

    // Pass --debug in development so parser writes [BILL_DEBUG] lines to stderr
    const args = IS_DEV
      ? [scriptPath, "--debug", "--stdin"]
      : [scriptPath, "--stdin"];

    const py = spawn("python3", args);

    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    py.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    py.on("close", (code) => {
      // In dev, print all [BILL_DEBUG] lines to the Next.js server console
      if (IS_DEV && stderr) {
        for (const line of stderr.split("\n")) {
          if (line.trim()) console.debug(line);
        }
      }

      if (code !== 0) {
        // In dev surface the full stderr in the response for easy inspection
        const message = IS_DEV
          ? stderr || `Parser exited with code ${code}`
          : `Parser exited with code ${code}`;
        resolve(NextResponse.json({ error: message }, { status: 500 }));
        return;
      }

      try {
        resolve(NextResponse.json(JSON.parse(stdout)));
      } catch {
        resolve(
          NextResponse.json({ error: "Parser returned invalid JSON" }, { status: 500 })
        );
      }
    });

    py.stdin.write(pdfBytes);
    py.stdin.end();
  });
}
