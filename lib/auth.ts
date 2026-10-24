import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SECRET = process.env.SECRET_KEY || process.env.ADMIN_PASSWORD || "sis-lpi-super-secret-key-2026";

export interface UserSession {
  id: number;
  username: string;
  name: string;
  role: "super_admin" | "admin" | "institusi";
  institutionId: string | null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const computed = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

export function signToken(payload: UserSession): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(data)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      )
    ) {
      return null;
    }

    const json = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    return json as UserSession;
  } catch {
    return null;
  }
}

/**
 * Get current logged in user from Next.js server context (Route handler or Server Component)
 */
export async function getSessionUser(request?: NextRequest): Promise<UserSession | null> {
  let token: string | undefined;

  if (request) {
    token = request.cookies.get("auth_session")?.value;
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get("auth_session")?.value;
    } catch {
      // In non-request context
    }
  }

  if (!token) {
    // Fallback: check admin_session legacy cookie
    return null;
  }

  return verifyToken(token);
}
