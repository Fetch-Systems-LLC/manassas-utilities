import { NextResponse } from "next/server";
import { Resend } from "resend";

// Simple in-memory rate limiter
// Map<IP, Timestamp>
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();

    // Check rate limit
    if (rateLimitMap.has(ip)) {
      const lastRequest = rateLimitMap.get(ip)!;
      if (now - lastRequest < RATE_LIMIT_WINDOW) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a minute." },
          { status: 429 },
        );
      }
    }
    rateLimitMap.set(ip, now);

    // Clean up old entries periodically (simple garbage collection)
    if (rateLimitMap.size > 1000) {
      for (const [key, timestamp] of rateLimitMap.entries()) {
        if (now - timestamp > RATE_LIMIT_WINDOW) {
          rateLimitMap.delete(key);
        }
      }
    }

    const { name, email, message, subject, honeyPot } = await req.json();

    // Spam check: Honeypot field
    if (honeyPot) {
      // Silently fail for bots
      return NextResponse.json({ success: true });
    }

    if (!message || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn("RESEND_API_KEY is missing. Email not sent.");
      return NextResponse.json(
        { error: "Server configuration error: Missing API Key" },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from: "noreply@fetchsystemsllc.com",
      to: ["support@fetchsystemsllc.com"],
      replyTo: email,
      subject: `[Support] ${subject || "New Inquiry"}`,
      text: `Name: ${name || "N/A"}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    if (error) {
      console.error("Resend Error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Support API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
