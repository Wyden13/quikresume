// src/lib/contact/link-check.ts
// Server-side existence checks for the header links. Deliberately polite:
// - LinkedIn is never fetched (its User Agreement forbids automated access and it answers bots with 999);
//   the caller records a format check only.
// - GitHub goes through the public REST API (api.github.com/users/<name>), which its terms allow.
// - Personal sites get one HEAD (GET fallback) with an honest user agent, 5 s timeout, at most 3 redirects.
//   Every hop resolves DNS through a guard that refuses private / loopback / link-local addresses, so a
//   user-supplied URL can't make the server probe its own network (checked at connect time, which also
//   covers DNS rebinding).

import "server-only";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import type { LinkStatus } from "./types";

export interface LinkResult { status: LinkStatus; detail: string | null }

const UA = "quikResume-link-check/1.0 (+verifies links on your own résumé)";
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

function ipv4Private(ip: string): boolean {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** True for addresses a link check must never connect to. */
export function isPrivateAddress(ip: string): boolean {
    if (net.isIPv4(ip)) return ipv4Private(ip);
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return ipv4Private(mapped[1]);
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9")
        || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff") || v.startsWith("::ffff:");
}

class BlockedAddress extends Error {
    constructor() { super("blocked address"); this.name = "BlockedAddress"; }
}

const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, family: options.family as number | undefined }, (err, addresses) => {
        if (err) return (callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(err, "", 4);
        const list = addresses as dns.LookupAddress[];
        if (list.length === 0 || list.some(a => isPrivateAddress(a.address))) {
            return (callback as (e: Error | null, a: string, f: number) => void)(new BlockedAddress(), "", 4);
        }
        if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
        (callback as (e: null, a: string, f: number) => void)(null, list[0].address, list[0].family);
    });
};

interface Hop { status: number; location: string | null }

function request(url: URL, method: "HEAD" | "GET"): Promise<Hop> {
    return new Promise((resolve, reject) => {
        const lib = url.protocol === "https:" ? https : http;
        const req = lib.request(url, {
            method,
            lookup: guardedLookup,
            timeout: TIMEOUT_MS,
            headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
        }, res => {
            resolve({ status: res.statusCode ?? 0, location: typeof res.headers.location === "string" ? res.headers.location : null });
            // Headers are enough: never download the body.
            res.destroy();
        });
        req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
        req.on("error", reject);
        req.end();
    });
}

export async function checkWebsite(raw: string): Promise<LinkResult> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return { status: "unverifiable", detail: "Not a valid web address." };
    }
    try {
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            // Checked on every hop: Node skips `lookup` for IP literals, and redirects can point anywhere.
            const port = url.port ? Number(url.port) : null;
            if ((url.protocol !== "https:" && url.protocol !== "http:") || (port !== null && port !== 80 && port !== 443)) {
                return { status: "unverifiable", detail: "Only standard web addresses can be checked." };
            }
            const host = url.hostname.replace(/^\[|\]$/g, "");
            if (net.isIP(host) && isPrivateAddress(host)) return { status: "unverifiable", detail: "Private addresses are not checked." };
            let res = await request(url, "HEAD");
            if (res.status === 403 || res.status === 405 || res.status === 501) res = await request(url, "GET");
            if (res.status >= 300 && res.status < 400 && res.location) {
                url = new URL(res.location, url);
                continue;
            }
            if (res.status >= 200 && res.status < 300) return { status: "ok", detail: null };
            if (res.status === 404 || res.status === 410) return { status: "not-found", detail: `The page does not exist (HTTP ${res.status}).` };
            return { status: "unverifiable", detail: `The site answered HTTP ${res.status}.` };
        }
        return { status: "unverifiable", detail: "Too many redirects." };
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (err instanceof BlockedAddress) return { status: "unverifiable", detail: "Private addresses are not checked." };
        if (code === "ENOTFOUND") return { status: "not-found", detail: "This domain does not exist." };
        if (code === "ETIMEDOUT") return { status: "unverifiable", detail: "The site took too long to answer." };
        return { status: "unverifiable", detail: "The site could not be reached." };
    }
}

export async function checkGitHub(user: string): Promise<LinkResult> {
    const token = process.env.GITHUB_TOKEN;
    try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": UA,
                "X-GitHub-Api-Version": "2022-11-28",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
        });
        if (res.ok) return { status: "ok", detail: null };
        if (res.status === 404) return { status: "not-found", detail: `GitHub has no user named "${user}".` };
        return { status: "unverifiable", detail: res.status === 403 || res.status === 429 ? "GitHub rate limit reached; try again later." : `GitHub answered HTTP ${res.status}.` };
    } catch {
        return { status: "unverifiable", detail: "GitHub could not be reached." };
    }
}
