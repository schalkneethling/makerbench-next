import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

import { Agent, buildConnector } from "undici";

const DNS_LOOKUP_TIMEOUT_MS = 3_000;

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

function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return (
    BLOCKED_HOSTNAMES.has(normalizedHostname) ||
    normalizedHostname.endsWith(".localhost")
  );
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

function getMappedIpv4Address(address: string): string | null {
  const normalizedAddress = address.toLowerCase().split("%")[0];
  const dottedAddress = normalizedAddress.match(
    /(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/,
  )?.[1];
  if (dottedAddress) {
    return dottedAddress;
  }

  const [head = "", tail = ""] = normalizedAddress.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missingParts = 8 - headParts.length - tailParts.length;
  const parts = [
    ...headParts,
    ...Array.from({ length: Math.max(0, missingParts) }, () => "0"),
    ...tailParts,
  ];
  if (
    parts.length !== 8 ||
    parts.slice(0, 5).some((part) => Number.parseInt(part || "0", 16) !== 0) ||
    Number.parseInt(parts[5] || "0", 16) !== 0xffff
  ) {
    return null;
  }

  const high = Number.parseInt(parts[6] || "0", 16);
  const low = Number.parseInt(parts[7] || "0", 16);
  if (
    !Number.isInteger(high) ||
    !Number.isInteger(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }

  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isBlockedIpv6Address(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const mappedIpv4 = getMappedIpv4Address(normalizedAddress);
  if (mappedIpv4) {
    return isBlockedIpv4Address(mappedIpv4);
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

async function lookupPublicAddresses(hostname: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }).catch(() => []),
      new Promise<never[]>((resolve) => {
        timeoutId = setTimeout(() => resolve([]), DNS_LOOKUP_TIMEOUT_MS);
        timeoutId.unref?.();
      }),
    ]);

    return addresses.length > 0 &&
      addresses.every(({ address }) => !isBlockedIpAddress(address))
      ? addresses
      : [];
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function createPublicLookup(): LookupFunction {
  return (hostname, options, callback) => {
    if (isBlockedHostname(hostname)) {
      const error = new Error(
        "Hostname is not a public destination",
      ) as NodeJS.ErrnoException;
      error.code = "EACCES";
      callback(error, "", 0);
      return;
    }

    void lookupPublicAddresses(hostname).then((addresses) => {
      const requestedFamily = options.family ?? 0;
      const eligibleAddresses = requestedFamily
        ? addresses.filter(({ family }) => family === requestedFamily)
        : addresses;

      if (eligibleAddresses.length === 0) {
        const error = new Error(
          "Hostname did not resolve to a public address",
        ) as NodeJS.ErrnoException;
        error.code = "EACCES";
        callback(error, "", 0);
        return;
      }

      if (options.all) {
        callback(null, eligibleAddresses);
        return;
      }

      const [address] = eligibleAddresses;
      callback(null, address.address, address.family);
    });
  };
}

function createPublicConnector() {
  const connect = buildConnector({ lookup: createPublicLookup() });

  return (
    options: Parameters<typeof connect>[0],
    callback: Parameters<typeof connect>[1],
  ) => {
    const hostname = options.hostname.replace(/^\[|\]$/g, "");
    if (isIP(hostname) && isBlockedIpAddress(hostname)) {
      const error = new Error(
        "Connection target is not a public address",
      ) as NodeJS.ErrnoException;
      error.code = "EACCES";
      callback(error, null);
      return;
    }

    connect(options, callback);
  };
}

export interface ResolvedPublicUrl {
  url: string;
  dispatcher: Agent;
}

/**
 * Resolves a public HTTP(S) URL and creates a dispatcher that revalidates DNS
 * at socket-connection time, pinning each connection to the returned address.
 */
export async function resolvePublicHttpUrl(
  value: string,
): Promise<ResolvedPublicUrl | null> {
  const url = parseHttpUrl(value);
  if (!url) {
    return null;
  }

  const hostname = getHostname(url);
  if (isBlockedHostname(hostname) || isBlockedIpAddress(hostname)) {
    return null;
  }

  if (!isIP(hostname)) {
    const addresses = await lookupPublicAddresses(hostname);
    if (addresses.length === 0) {
      return null;
    }
  }

  return {
    url: url.href,
    dispatcher: new Agent({
      connect: createPublicConnector(),
    }),
  };
}
