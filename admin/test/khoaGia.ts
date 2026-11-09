// Bộ khóa giả cho test: sinh cặp khóa RSA, ký JWT giống Cloudflare Access, phục vụ JWKS qua HTTP cục bộ.
// Chỉ dùng trong test/ và khi chạy thử cục bộ (test/dev.ts), không liên quan bản deploy.

import { createServer } from "node:http";
import type { Server } from "node:http";

export const TEAM = "thu.cloudflareaccess.com";
export const AUD = "aud-thu-admin";

export interface KhoaGia {
  kid: string;
  priv: CryptoKey;
  jwk: JsonWebKey & { kid: string };
}

function b64url(b: Uint8Array | string): string {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b;
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function taoKhoa(kid = "k1"): Promise<KhoaGia> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { kid, priv: pair.privateKey, jwk: { kty: pub.kty, n: pub.n, e: pub.e, alg: "RS256", use: "sig", kid } };
}

export async function kyJwt(k: KhoaGia, claims: Record<string, unknown>, header: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", kid: k.kid, typ: "JWT", ...header }));
  const p = b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, iat: now, nbf: now, exp: now + 3600, type: "app", sub: "u-1", ...claims }));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.priv, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

/** Máy chủ JWKS giả: GET /certs trả { keys: [...] } như /cdn-cgi/access/certs. */
export function phucVuKhoa(keys: JsonWebKey[], port = 0): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === "/certs") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ keys, public_cert: null, public_certs: [] }));
      } else {
        res.writeHead(404).end();
      }
    });
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const p = typeof addr === "object" && addr ? addr.port : port;
      resolve({ server, url: `http://127.0.0.1:${p}/certs` });
    });
  });
}
