import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchSite, isPrivateIp } from "./fetch-site";

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.10",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "not-an-ip",
  ])("%s é bloqueado", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "200.147.67.142", "2001:4860:4860::8888", "::ffff:8.8.8.8"])("%s é público", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("fetchSite: proteção SSRF", () => {
  let hits = 0;
  let port = 0;
  const server = http.createServer((_req, res) => {
    hits++;
    res.end("<html>interno</html>");
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it.each(["http://127.0.0.1", "http://localhost", "http://[::1]", "http://0.0.0.0"])("não requisita %s", async (base) => {
    const before = hits;
    const r = await fetchSite(`${base}:${port}/`);
    expect(r.kind).toBe("unreachable");
    expect(hits).toBe(before);
  });

  it("recusa protocolos que não são http/https", async () => {
    expect((await fetchSite("file:///etc/passwd")).kind).toBe("unreachable");
    expect((await fetchSite("ftp://exemplo.com/")).kind).toBe("unreachable");
  });

  it("host inexistente é unreachable", async () => {
    expect((await fetchSite("http://dominio-que-nao-existe-xyz-123.invalid/")).kind).toBe("unreachable");
  });
});
