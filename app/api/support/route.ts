import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createRateLimiter, getIp } from "@/lib/rate-limit";

// 3 support emails per IP per 15 minutes
const limiter = createRateLimiter(15 * 60_000, 3);

export async function POST(req: Request) {
  try {
    const ip = getIp(req);
    const { allowed, retryAfter } = limiter(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
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
