import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createGzip } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pinnedTransport } from "./transport.js";

// Transport réel contre un serveur HTTP local (127.0.0.1, port libre) : aucun accès extérieur

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/redirige") {
      res.writeHead(302, { location: "/ailleurs" }).end();
      return;
    }
    if (req.url === "/gzip") {
      // 8 Mo de zéros, compressés à la volée (quelques Ko sur le réseau)
      res.writeHead(200, { "content-type": "text/plain", "content-encoding": "gzip" });
      const gzip = createGzip();
      gzip.pipe(res);
      const chunk = Buffer.alloc(64 * 1024);
      let sent = 0;
      const write = () => {
        while (sent < 128) {
          sent++;
          if (!gzip.write(chunk)) return gzip.once("drain", write);
        }
        gzip.end();
      };
      write();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ host: req.headers.host, path: req.url }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("transport épinglé", () => {
  it("[C10] se connecte à l'adresse donnée sans résoudre le nom, en gardant l'en-tête Host", async () => {
    // .invalid n'existe dans aucun DNS (RFC 2606) : seule l'adresse épinglée permet d'arriver
    const url = new URL(`http://flowops-epingle.invalid:${port}/chemin`);

    const response = await pinnedTransport(url, { method: "GET" }, "127.0.0.1");

    expect(await response.json()).toEqual({
      host: `flowops-epingle.invalid:${port}`,
      path: "/chemin",
    });
  });

  it("[R1] ne suit pas les redirections lui-même", async () => {
    const url = new URL(`http://flowops-epingle.invalid:${port}/redirige`);

    const response = await pinnedTransport(url, { redirect: "manual" }, "127.0.0.1");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ailleurs");
  });

  it("[L4] fournit le corps décompressé, que le moteur compte octet par octet", async () => {
    const url = new URL(`http://flowops-epingle.invalid:${port}/gzip`);

    const response = await pinnedTransport(url, {}, "127.0.0.1");
    const reader = response.body!.getReader();
    const first = await reader.read();
    await reader.cancel();

    // Octets décompressés (des zéros), pas le flux gzip
    expect(first.value?.every((byte) => byte === 0)).toBe(true);
  });

  it("rejette avec la cause réseau quand la connexion est refusée", async () => {
    // Port libéré juste avant : plus rien n'y écoute
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));

    const error = await pinnedTransport(
      new URL(`http://flowops-epingle.invalid:${closedPort}/`),
      {},
      "127.0.0.1",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TypeError);
    expect(((error as Error).cause as { code?: string }).code).toBe("ECONNREFUSED");
  });
});
