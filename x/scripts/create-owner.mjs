#!/usr/bin/env node
/**
 * LOVECRAFT BOT — Secure Out-of-Band Owner Provisioning CLI
 * Usage:
 *   OWNER_USERNAME="owner" OWNER_EMAIL="owner@domain.com" OWNER_PASSWORD="StrongPassword123!" node scripts/create-owner.mjs
 *
 * Security rules:
 * - No public admin registration exists.
 * - No default or hardcoded credentials exist.
 * - Enforces strong password policy and stores scrypt+salt hash only.
 */
import crypto from "node:crypto";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

async function hashPassword(plain) {
  const salt = crypto.randomBytes(32).toString("hex");
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const username = (process.env.OWNER_USERNAME || "").trim().toLowerCase();
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || "";

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is required.");
    process.exit(1);
  }
  if (!username || username.length < 3 || !email.includes("@")) {
    console.error("ERROR: Valid OWNER_USERNAME and OWNER_EMAIL env vars are required.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ERROR: OWNER_PASSWORD must be at least 12 characters long.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const res = await pool.query(
      `INSERT INTO admin_users (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'owner', true)
       ON CONFLICT (username) DO UPDATE
         SET email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             is_active = true,
             failed_login_attempts = 0,
             locked_until = NULL
       RETURNING id, username, email, role`,
      [username, email, passwordHash]
    );
    const admin = res.rows[0];
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, metadata)
       VALUES ($1, 'owner_provisioned_cli', 'admin_user', $2, $3)`,
      [admin.id, String(admin.id), JSON.stringify({ method: "secure_cli" })]
    );
    console.log(`Owner account provisioned successfully: #${admin.id} (${admin.username} / ${admin.email})`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Provisioning failed:", err.message);
  process.exit(1);
});
