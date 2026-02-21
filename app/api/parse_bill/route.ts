import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

const IS_DEV = process.env.NODE_ENV === "development";

export async function POST(req: NextRequest) {
  const pdfBytes = Buffer.from(await req.arrayBuffer());

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
