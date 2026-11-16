/* Optional "Pay with USDC" (Base network) straight to Mimi's receiving address.
   OFF unless WD_CRYPTO_TREASURY (0x… address) is set. Verifies on-chain via public RPC:
   tx succeeded, USDC Transfer log to the treasury >= order total, sender is one of the
   member's verified sign-in wallets, and each tx hash can only pay one order. */
import { r } from "./redis.js";
const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const cryptoCfg = () => { const t = String(process.env.WD_CRYPTO_TREASURY || "").trim().toLowerCase(); return /^0x[0-9a-f]{40}$/.test(t) ? { treasury: t, chainId: 8453, token: USDC_BASE, decimals: 6, rpc: process.env.WD_BASE_RPC || "https://mainnet.base.org" } : null; };
async function rpc(url, method, params) { const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const d = await res.json().catch(() => ({})); if (d.error) throw E("rpc_error", 502); return d.result; }
export async function verifyUsdcPayment(txHash, order, wallets) {
  const c = cryptoCfg(); if (!c) throw E("crypto_off", 404);
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash))) throw E("bad_tx");
  const rc = await rpc(c.rpc, "eth_getTransactionReceipt", [txHash]);
  if (!rc) throw E("tx_pending", 202);
  if (rc.status !== "0x1") throw E("tx_failed");
  const from = String(rc.from || "").toLowerCase();
  if (!wallets.includes(from)) throw E("wallet_mismatch", 403);
  const pad = (a) => "0x" + a.slice(2).padStart(64, "0");
  let paid = 0n;
  for (const l of rc.logs || []) if (String(l.address).toLowerCase() === c.token && l.topics && l.topics[0] === TRANSFER && String(l.topics[2]).toLowerCase() === pad(c.treasury)) paid += BigInt(l.data);
  const need = BigInt(Math.round(order.total * 100)) * 10n ** BigInt(c.decimals - 2);
  if (paid < need) throw E("underpaid");
  if (!(await r("SET", "wd:tx:" + txHash.toLowerCase(), order.id, "NX"))) throw E("tx_used", 409);
  return { id: txHash, amount: Number(paid) / 10 ** c.decimals, method: "usdc_base", from };
}
