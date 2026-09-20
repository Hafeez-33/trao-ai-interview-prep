import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";
import { CrawlerError } from "./types.js";

const FORBIDDEN_IPV4_RANGES = new Set([
  "unspecified",
  "broadcast",
  "linkLocal",
  "loopback",
  "private",
  "carrierGradeNat",
  "reserved",
]);

const FORBIDDEN_IPV6_RANGES = new Set([
  "unspecified",
  "linkLocal",
  "multicast",
  "loopback",
  "uniqueLocal",
  "reserved",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

/**
 * Normalizes a URL using standard WHATWG URL parsing.
 * Resolves relative URLs against baseUrl, strips hash fragments, and validates scheme.
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new CrawlerError("Invalid URL provided.", "INVALID_INPUT_PARAMETERS", 400);
  }

  let parsed: URL;
  try {
    parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  } catch {
    throw new CrawlerError(`Malformed URL: ${rawUrl}`, "INVALID_INPUT_PARAMETERS", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CrawlerError(
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
      "SSRF_FORBIDDEN_DESTINATION",
      400
    );
  }

  if (parsed.username || parsed.password) {
    throw new CrawlerError(
      "URLs with embedded credentials are not permitted.",
      "SSRF_FORBIDDEN_DESTINATION",
      400
    );
  }

  parsed.hash = "";
  return parsed.toString();
}

/**
 * Validates whether an IP address string belongs to a forbidden private/internal range.
 */
export function isForbiddenIp(ipString: string): boolean {
  try {
    let parsedIp = ipaddr.parse(ipString);

    // Convert IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) to native IPv4
    if (parsedIp.kind() === "ipv6") {
      const ipv6 = parsedIp as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) {
        parsedIp = ipv6.toIPv4Address();
      }
    }

    if (parsedIp.kind() === "ipv4") {
      const range = (parsedIp as ipaddr.IPv4).range();
      if (FORBIDDEN_IPV4_RANGES.has(range)) {
        return true;
      }
      // Explicit cloud metadata IP: 169.254.169.254
      const octets = (parsedIp as ipaddr.IPv4).octets;
      if (octets[0] === 169 && octets[1] === 254 && octets[2] === 169 && octets[3] === 254) {
        return true;
      }
      // Alibaba cloud metadata: 100.100.100.200
      if (octets[0] === 100 && octets[1] === 100 && octets[2] === 100 && octets[3] === 200) {
        return true;
      }
      return false;
    }

    if (parsedIp.kind() === "ipv6") {
      const range = (parsedIp as ipaddr.IPv6).range();
      return FORBIDDEN_IPV6_RANGES.has(range);
    }

    return true;
  } catch {
    // If parsing fails, treat as unsafe
    return true;
  }
}

/**
 * Validates a URL against SSRF vulnerabilities:
 * 1. Checks protocol and credential safety.
 * 2. Checks against metadata hostnames.
 * 3. Resolves DNS and validates all A/AAAA records against private/loopback/link-local ranges.
 *
 * In evaluation/test mode, explicitly configured local test targets (localhost/127.0.0.1)
 * can be permitted if allowLocalTestUrls is true.
 */
export async function validateUrlSsrf(
  targetUrl: string,
  options?: { allowLocalTestUrls?: boolean }
): Promise<string> {
  const normalized = normalizeUrl(targetUrl);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.toLowerCase();

  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

  // Development / Evaluation mode override for test fixture servers
  if (options?.allowLocalTestUrls && isLocalHost) {
    return normalized;
  }

  // Check known blocked hostnames in production mode
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".internal")) {
    throw new CrawlerError(
      `Access to internal hostname '${hostname}' is forbidden (SSRF protection).`,
      "SSRF_FORBIDDEN_DESTINATION",
      400
    );
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isForbiddenIp(hostname)) {
      throw new CrawlerError(
        `Direct access to private or reserved IP '${hostname}' is forbidden (SSRF protection).`,
        "SSRF_FORBIDDEN_DESTINATION",
        400
      );
    }
    return normalized;
  }

  // Resolve DNS to inspect all A and AAAA records
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });

    if (!lookupResults || lookupResults.length === 0) {
      throw new CrawlerError(
        `Could not resolve hostname '${hostname}'.`,
        "COMPANY_UNREACHABLE",
        400
      );
    }

    for (const record of lookupResults) {
      if (isForbiddenIp(record.address)) {
        throw new CrawlerError(
          `Resolved IP '${record.address}' for host '${hostname}' is forbidden (SSRF protection).`,
          "SSRF_FORBIDDEN_DESTINATION",
          400
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof CrawlerError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "DNS resolution failure";
    throw new CrawlerError(
      `DNS resolution failed for '${hostname}': ${message}`,
      "COMPANY_UNREACHABLE",
      400
    );
  }

  return normalized;
}
