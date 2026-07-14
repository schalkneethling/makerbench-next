import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookupFunction } from "node:net";
import type { buildConnector } from "undici";

const agentState = vi.hoisted(() => ({
  agentOptions: null as { connect?: buildConnector.connector } | null,
  connectorOptions: null as { lookup?: LookupFunction } | null,
  baseConnector: vi.fn(),
}));

vi.mock("undici", () => ({
  Agent: class MockAgent {
    constructor(options: typeof agentState.agentOptions) {
      agentState.agentOptions = options;
    }

    close = vi.fn().mockResolvedValue(undefined);
  },
  buildConnector: vi.fn((options) => {
    agentState.connectorOptions = options;
    return agentState.baseConnector;
  }),
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";

import { resolvePublicHttpUrl } from "../public-url";

describe("resolvePublicHttpUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentState.agentOptions = null;
    agentState.connectorOptions = null;
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("revalidates DNS in the connection lookup and pins the returned address", async () => {
    const resolved = await resolvePublicHttpUrl("https://example.com/resource");
    const connectionLookup = agentState.connectorOptions?.lookup;

    expect(resolved?.url).toBe("https://example.com/resource");
    expect(connectionLookup).toBeTypeOf("function");

    const callback = vi.fn();
    connectionLookup?.("example.com", { family: 0, all: false }, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it("rejects a hostname that rebinds to a private address at connection time", async () => {
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    await resolvePublicHttpUrl("https://example.com/resource");
    const connectionLookup = agentState.connectorOptions?.lookup;
    const callback = vi.fn();

    connectionLookup?.("example.com", { family: 0, all: false }, callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback.mock.calls[0]?.[0]).toMatchObject({ code: "EACCES" });
  });

  it("rejects a private IP redirect in the connection path", async () => {
    await resolvePublicHttpUrl("https://example.com/resource");
    const connector = agentState.agentOptions?.connect;
    const callback = vi.fn();

    connector?.(
      {
        hostname: "127.0.0.1",
        protocol: "http:",
        port: "80",
      },
      callback,
    );

    expect(callback.mock.calls[0]?.[0]).toMatchObject({ code: "EACCES" });
    expect(agentState.baseConnector).not.toHaveBeenCalled();
  });

  it("rejects a localhost redirect before connection-time DNS", async () => {
    await resolvePublicHttpUrl("https://example.com/resource");
    const connectionLookup = agentState.connectorOptions?.lookup;
    const callback = vi.fn();

    connectionLookup?.(
      "service.localhost",
      { family: 0, all: false },
      callback,
    );

    expect(callback.mock.calls[0]?.[0]).toMatchObject({ code: "EACCES" });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("fails closed when DNS lookup exceeds the timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(lookup).mockReturnValue(new Promise(() => {}) as never);

    const resolution = resolvePublicHttpUrl("https://example.com/resource");
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(resolution).resolves.toBeNull();
  });

  it("rejects mixed public and private DNS answers", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ] as never);

    await expect(
      resolvePublicHttpUrl("https://example.com/resource"),
    ).resolves.toBeNull();
  });

  it("rejects hexadecimal IPv4-mapped IPv6 loopback addresses", async () => {
    await expect(
      resolvePublicHttpUrl("http://[::ffff:7f00:1]/admin"),
    ).resolves.toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
});
