import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

const BLOCKED_IPV4_RANGES: readonly [
  baseAddress: string,
  prefixLength: number,
][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getHostname(url: URL): string {
  return url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function ipv4ToNumber(address: string): number | null {
  const octets = address.split(".").map((octet) => Number(octet));

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }

  return octets.reduce((value, octet) => value * 256 + octet, 0) >>> 0;
}

function isIpv4InRange(
  address: string,
  baseAddress: string,
  prefixLength: number,
): boolean {
  const addressNumber = ipv4ToNumber(address);
  const baseNumber = ipv4ToNumber(baseAddress);

  if (addressNumber === null || baseNumber === null) {
    return false;
  }

  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (addressNumber & mask) === (baseNumber & mask);
}

function isBlockedIpv4Address(address: string): boolean {
  return BLOCKED_IPV4_RANGES.some(([baseAddress, prefixLength]) =>
    isIpv4InRange(address, baseAddress, prefixLength),
  );
}

function isBlockedIpv6Address(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const mappedIpv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4?.[1]) {
    return isBlockedIpv4Address(mappedIpv4[1]);
  }

  const firstHextet = Number.parseInt(
    normalizedAddress.split(":")[0] || "0",
    16,
  );
  return (
    normalizedAddress === "::" ||
    normalizedAddress === "::1" ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

function isBlockedIpAddress(address: string): boolean {
  const ipVersion = isIP(address);

  if (ipVersion === 4) {
    return isBlockedIpv4Address(address);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6Address(address);
  }

  return false;
}

/** Resolves an HTTP(S) URL only when its hostname maps exclusively to public addresses. */
export async function resolvePublicHttpUrl(
  value: string,
): Promise<string | null> {
  const url = parseHttpUrl(value);
  if (!url) {
    return null;
  }

  const hostname = getHostname(url);
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    isBlockedIpAddress(hostname)
  ) {
    return null;
  }

  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true }).catch(() => []);
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isBlockedIpAddress(address))
    ) {
      return null;
    }
  }

  return url.href;
}
