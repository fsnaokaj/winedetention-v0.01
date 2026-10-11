import { createRemoteJWKSet, jwtVerify } from "jose";
/* Dynamic.xyz JWT verification. DYNAMIC_ENV_ID must be set in Vercel; until then sign-in is "opening soon". */
export const ENV_ID = () => (process.env.DYNAMIC_ENV_ID || "cbc67f03-fe81-4a64-aa5e-b01f1bcf4ce2").trim();
let jwks = null, jwksEnv = null;
const E = (m, s) => Object.assign(new Error(m), { status: s });
export async function verify(req) {
  const env = ENV_ID(); if (!env) throw E("auth_not_configured", 503);
  const h = req.headers.authorization || ""; const tok = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!tok) throw E("missing_token", 401);
  if (process.env.WD_TEST_AUTH === "1" && tok.startsWith("test:")) return { sub: tok.slice(5), email: tok.slice(5) + "@test.local" };
  if (!jwks || jwksEnv !== env) { jwks = createRemoteJWKSet(new URL(`https://app.dynamicauth.com/api/v0/sdk/${env}/.well-known/jwks`)); jwksEnv = env; }
  try {
    const { payload } = await jwtVerify(tok, jwks, { algorithms: ["RS256"] });
    if (!payload.sub) throw 0;
    if (payload.environment_id && payload.environment_id !== env) throw 0;
    if (typeof payload.scope === "string" && payload.scope.includes("requiresAdditionalAuth")) throw 0;
    return payload;
  } catch { throw E("invalid_token", 401); }
}
