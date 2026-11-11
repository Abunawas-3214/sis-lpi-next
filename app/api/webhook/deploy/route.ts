import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { exec } from "child_process";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      console.error("WEBHOOK_SECRET is not configured in .env");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, { status: 401 });
    }

    // Baca raw body
    const bodyText = await request.text();

    // Verifikasi HMAC SHA256 Signature dari GitHub
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(bodyText).digest("hex");

    const sigBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const payload = JSON.parse(bodyText);

    // Hanya proses jika push event ke branch main atau master
    const ref = payload.ref;
    if (ref !== "refs/heads/main" && ref !== "refs/heads/master") {
      return NextResponse.json({ message: "Ignored branch: " + ref });
    }

    console.log("🚀 Webhook received! Triggering deployment script in background...");

    // Jalankan script deployment secara asynchronous di server Linux
    exec("bash /var/www/sis-lpi/deploy.sh > /var/log/sis-lpi-deploy.log 2>&1 &", (err) => {
      if (err) {
        console.error("Error launching deploy script:", err);
      }
    });

    return NextResponse.json({
      status: "success",
      message: "Deployment triggered successfully",
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
