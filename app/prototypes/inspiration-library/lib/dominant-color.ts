/**
 * Finding a picture's dominant colour. Server only.
 *
 * Called when an item with a picture is saved (actions.ts). It never stops
 * an item from being saved: if the picture can't be read, the colour is
 * just left empty (null) and the item goes at the end of the "By colour"
 * view.
 *
 * HOW IT WORKS
 *   1. Get the picture's bytes: from your private Storage bucket for an
 *      uploaded picture, or from the other website for an image address.
 *   2. Shrink it to at most 64 × 64 pixels with `sharp`. That's plenty to
 *      judge the colours, and quick.
 *   3. Put every pixel into a "bucket" of similar colours (16 levels each
 *      of red, green and blue, so 4,096 buckets), skipping see-through
 *      pixels.
 *   4. The fullest bucket wins. Its colour is the average of the pixels in
 *      it, written as a hex code like "#d4532f".
 *
 * "Dominant" means "covers the most of the picture", so a product photo on
 * a big white background really is mostly white.
 *
 * FETCHING SAFELY (for image addresses)
 * Our server downloads an address you typed. Without care, someone could
 * type an address that points INSIDE the server's own network (like
 * http://169.254.169.254/, where cloud servers keep secrets) and make our
 * server fetch it for them: an attack called SSRF. So every download:
 *   - only uses http or https, on the normal ports,
 *   - checks the address the website's name actually leads to, at the
 *     moment of connecting, and refuses private or internal ones,
 *   - follows at most 3 redirects, checking each one the same way,
 *   - gives up after 8 seconds or 10 MB, and only accepts images.
 */

import "server-only";
import { lookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import sharp from "sharp";
import { downloadImage } from "./storage";

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

/** The picture of an item: an address on another website, or an uploaded file's path. */
export async function findDominantColor(picture: { url: string | null; path: string | null }): Promise<string | null> {
  try {
    const bytes = picture.path ? await downloadImage(picture.path) : picture.url ? await fetchImage(picture.url) : null;
    return bytes ? await dominantColorOf(bytes) : null;
  } catch (error) {
    console.error("[inspiration-library] Couldn't find a picture's colour:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Steps 2–4: the most common colour in an image file, as "#rrggbb". */
export async function dominantColorOf(bytes: Buffer): Promise<string | null> {
  const { data, info } = await sharp(bytes, {
    // Refuse absurdly large images (a tiny file can claim to be enormous).
    limitInputPixels: 50_000_000,
  })
    .rotate() // turn phone photos the right way up
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // One entry per bucket: how many pixels, and their red, green and blue added up.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, alpha] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (alpha < 128) continue; // mostly see-through: not part of the picture
    // Keep the top 4 bits of each: 16 levels per colour, so similar colours share a bucket.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  if (!best) return null; // completely see-through

  const hex = (sum: number) =>
    Math.round(sum / best.count)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

/* ---------- Downloading an image address safely ---------- */

/** Addresses that belong to a private or internal network, never the public internet. */
const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // shared by internet providers
  ["127.0.0.0", 8], // this computer
  ["169.254.0.0", 16], // link-local, including cloud metadata servers
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24],
  ["192.168.0.0", 16], // private (most home Wi-Fi)
  ["198.18.0.0", 15], // testing
  ["224.0.0.0", 3], // multicast and reserved
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128], // this computer
  ["fc00::", 7], // private
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  PRIVATE.addSubnet(net, prefix, "ipv6");
}

function isPrivateAddress(address: string): boolean {
  // "::ffff:10.0.0.1" is an IPv4 address written as IPv6: check the IPv4 part.
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return PRIVATE.check(mapped[1], "ipv4");
  return PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/**
 * Looks up a website's name like the normal lookup does, but refuses to
 * connect if any address it leads to is private. Because this runs at the
 * moment of connecting, a website can't pass the check and then switch to
 * a private address.
 */
const guardedLookup: typeof lookup = ((hostname: string, options: object, callback: (...args: unknown[]) => void) => {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new Error(`Refused to fetch ${hostname}: it leads to a private address.`));
    }
    // Answer in the shape the caller asked for: a list, or just the first address.
    if ((options as { all?: boolean }).all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}) as typeof lookup;

/** Downloads an image address, following up to MAX_REDIRECTS redirects, each checked again. */
async function fetchImage(address: string, redirectsLeft = MAX_REDIRECTS): Promise<Buffer | null> {
  const url = new URL(address);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  if (url.username || url.password) return null;
  // An address typed as numbers (like http://10.0.0.1/) is checked directly.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) return null;

  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { accept: "image/*", "user-agent": "InspirationLibrary/1.0 (dominant colour)" },
      },
      (response) => {
        const status = response.statusCode ?? 0;

        // A redirect: start again at the new address (and check it again).
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirectsLeft === 0) return resolve(null);
          resolve(fetchImage(new URL(response.headers.location, url).toString(), redirectsLeft - 1));
          return;
        }
        const type = response.headers["content-type"] ?? "";
        const length = Number(response.headers["content-length"] ?? 0);
        if (status !== 200 || !type.startsWith("image/") || type.includes("svg") || length > MAX_BYTES) {
          response.resume();
          return resolve(null);
        }

        // Read the picture, stopping if it turns out to be bigger than allowed.
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy();
            resolve(null);
          } else {
            chunks.push(chunk);
          }
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("The image took too long to download.")));
    request.on("error", reject);
  });
}
