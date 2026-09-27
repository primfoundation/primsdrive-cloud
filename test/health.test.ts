import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleRequest } from "../src/index.ts";
import { HEALTH } from "../src/responses.ts";

function get(path: string, method = "GET"): Promise<Response> {
  return Promise.resolve(handleRequest(new Request(`https://drive.prims.sh${path}`, { method })));
}

describe("drive.prims.sh stub", () => {
  it("returns the known health document on / and /health", async () => {
    for (const path of ["/", "/health", "/health/"]) {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(await res.json(), HEALTH);
    }
  });

  it("rejects non-GET health probes", async () => {
    const res = await get("/health", "POST");
    assert.equal(res.status, 405);
    assert.equal(res.headers.get("allow"), "GET");
  });

  it("answers /v1/* and /mcp with placeholders", async () => {
    const v1 = await get("/v1/packs", "PUT");
    assert.equal(v1.status, 200);
    assert.deepEqual(await v1.json(), {
      ok: true,
      service: "primsdrive-cloud",
      status: "placeholder",
      route: "/v1/*",
      implemented: false,
    });

    const mcp = await get("/mcp");
    assert.equal(mcp.status, 200);
    const body = await mcp.json() as { route: string; implemented: boolean };
    assert.equal(body.route, "/mcp");
    assert.equal(body.implemented, false);
  });

  it("does not treat nearby paths as routes", async () => {
    for (const path of ["/v1foo", "/mcp/tools", "/healthz", "/sandisk"]) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
    }
  });
});
