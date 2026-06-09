import { SignJWT, jwtVerify } from "jose";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/lib/dataDir";

function loadMultiUserJwtSecret() {
  if (process.env.MULTI_USER_JWT_SECRET) return process.env.MULTI_USER_JWT_SECRET;
  const file = path.join(DATA_DIR, "multi-user-jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    // File does not exist yet
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = new TextEncoder().encode(loadMultiUserJwtSecret());

export async function createUserToken(user) {
  return new SignJWT({ userId: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyUserToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyUserToken(token);
}
