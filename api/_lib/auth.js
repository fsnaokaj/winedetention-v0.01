import { createRemoteJWKSet, jwtVerify } from "jose";
/* Sign-in token verification (Dynamic JWTs, RS256 via the environment JWKS).
   Production reads DYNAMIC_ENV_ID only. Previews/local fall back to the known env id so
   preview links keep working; production never uses a hardcoded id. */
const DEV_FALLBACK_ENV = "cbc67f03-fe81-4a64-aa5e-b01f1bcf4ce2";
export const isProd = () => process.env.VERCEL_ENV === "production";
export const ENV_ID = () => {
  const v = String(process.env.DYNAMIC_ENV_ID || "").trim();
  if (v) return v;
  return isProd() ? "" : DEV_FALLBACK_ENV;
};
/* WD_TEST_AUTH=1 enables "test:<id>" bearer tokens for LOCAL testing only (never on Vercel). */
export const testAuthOn = () => process.env.WD_TEST_AUTH === "1" && !process.env.VERCEL && !process.env.VERCEL_ENV;
let jwks = null, jwksEnv = null;
const E = (m, s) => Object.assign(new Error(m), { status: s });
export const walletsOf = (p) => ((p && p.verified_credentials) || []).filter((c) => c && c.format === "blockchain" && c.address).map((c) => String(c.address).toLowerCase());
export async function verify(req) {
  const env = ENV_ID(); if (!env) throw E("auth_not_configured", 503);
  const h = req.headers.authorization || ""; const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!tok) throw E("missing_token", 401);
  if (tok.startsWith("test:")) {
    if (!testAuthOn()) throw E("invalid_token", 401);
    const id = tok.slice(5).replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "tester";
    return { sub: "test-" + id, email: id + "@test.local", scope: "user:basic", verified_credentials: [] };
  }
  if (!jwks || jwksEnv !== env) { jwks = createRemoteJWKSet(new URL(`https://app.dynamicauth.com/api/v0/sdk/${env}/.well-known/jwks`)); jwksEnv = env; }
  let payload;
  try { ({ payload } = await jwtVerify(tok, jwks, { algorithms: ["RS256"], issuer: `app.dynamicauth.com/${env}`, clockTolerance: 30 })); }
  catch { throw E("invalid_token", 401); }
  const scopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/) : Array.isArray(payload.scope) ? payload.scope : [];
  if (!payload.sub) throw E("invalid_token", 401);
  if (payload.environment_id && payload.environment_id !== env) throw E("invalid_token", 401);
  if (scopes.includes("requiresAdditionalAuth")) throw E("needs_more_auth", 401);
  if (!scopes.includes("user:basic")) throw E("needs_more_auth", 401);
  return payload;
}
