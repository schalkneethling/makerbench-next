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
  let normalizedAddress = address.toLowerCase().split("%")[0];
  const dottedMatch = normalizedAddress.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMatch) {
    const ipv4Number = ipv4ToNumber(dottedMatch[2]);
    if (ipv4Number === null) {
      return null;
    }

    normalizedAddress = `${dottedMatch[1]}${(ipv4Number >>> 16).toString(16)}:${(
      ipv4Number & 0xffff
    ).toString(16)}`;
  }

  let parts: string[];
  if (normalizedAddress.includes("::")) {
    if (
      normalizedAddress.indexOf("::") !== normalizedAddress.lastIndexOf("::")
    ) {
      return null;
    }

    const [head = "", tail = ""] = normalizedAddress.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const missingParts = 8 - headParts.length - tailParts.length;
    if (missingParts < 1) {
      return null;
    }
    parts = [
      ...headParts,
      ...Array.from({ length: missingParts }, () => "0"),
      ...tailParts,
    ];
  } else {
    parts = normalizedAddress.split(":");
  }

  if (
    parts.length !== 8 ||
    parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))
  ) {
    return null;
  }

  const hextets = parts.map((part) => Number.parseInt(part, 16));
  const hasZeroPrefix = hextets.slice(0, 5).every((part) => part === 0);
  const isMapped = hasZeroPrefix && hextets[5] === 0xffff;
  const isCompatible = hasZeroPrefix && hextets[5] === 0;
  if (!isMapped && !isCompatible) {
    return null;
  }

  const high = hextets[6];
  const low = hextets[7];
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
