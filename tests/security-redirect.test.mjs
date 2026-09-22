import assert from "node:assert/strict";
import test from "node:test";
import { configuredSiteOrigin, safeInternalPath } from "../src/lib/security/redirect.ts";

test("post-auth redirects stay on local routes", () => {
  assert.equal(safeInternalPath("/children/123?area=need"), "/children/123?area=need");
  assert.equal(safeInternalPath("//evil.example"), "/dashboard");
  assert.equal(safeInternalPath("/\\evil.example"), "/dashboard");
  assert.equal(safeInternalPath("/\\\\evil.example"), "/dashboard");
  assert.equal(safeInternalPath("/%5c%5cevil.example"), "/dashboard");
  assert.equal(safeInternalPath("/%252f%252fevil.example"), "/dashboard");
  assert.equal(safeInternalPath("https://evil.example"), "/dashboard");
  assert.equal(safeInternalPath("/dashboard\nLocation: https://evil.example"), "/dashboard");
});

test("confirmation and recovery links use a configured HTTPS site", () => {
  assert.equal(configuredSiteOrigin("https://circle.example/en", "production", "https://evil.example"), "https://circle.example");
  assert.throws(() => configuredSiteOrigin(undefined, "production", "https://evil.example"));
  assert.throws(() => configuredSiteOrigin("http://circle.example", "production"));
  assert.equal(configuredSiteOrigin(undefined, "development", "https://evil.example"), "http://localhost:3000");
  assert.equal(configuredSiteOrigin(undefined, "development", "http://localhost:3001"), "http://localhost:3001");
});
