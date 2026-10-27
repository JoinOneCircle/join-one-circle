import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "../src/lib/security/request-origin.ts";
test("same-origin requests use the browser Host when Next normalises loopback and still reject cross-site posts", () => {
  const check = (origin, host = "127.0.0.1:3000", url = "http://localhost:3000/api/pilot") => isSameOriginRequest({ headers: new Headers({ ...(origin ? { origin } : {}), host }), url });
  assert.equal(check("http://127.0.0.1:3000"), true);
  assert.equal(check("http://localhost:3000", "localhost:3000"), true);
  assert.equal(check("https://school.example", "school.example", "https://school.example/api/pilot"), true);
  for (const origin of [null, "null", "https://evil.example", "http://localhost:3000", "http://127.0.0.1:3001", "https://127.0.0.1:3000", "http://user:pass@127.0.0.1:3000", "http://127.0.0.1:3000/path"]) assert.equal(check(origin), false);
});
