// Independent negative review probes. Only pure functions and injected fake fetch are used.
import assert from "node:assert/strict";
import test from "node:test";
import {
  planFeatureAdvisories,
  evaluateFeatureAdvisories,
  fetchFeatureAdvisories,
} from "./npm_feature_advisories.mjs";

const item = (name, version = "1.2.3") => ({
  name,
  version,
  location: `node_modules/${name}`,
  resolved: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
  integrity: "sha512-eA==",
});
const inventory = (primary, supplementary = primary) => ({
  schemaVersion: 1,
  status: "draft",
  scopeId: "pr1-model-npm",
  packages: primary,
  supplementaryPeerGraph: { packages: supplementary },
});
// The review probes only use fixed stable versions; production resolves the pinned real semver.
const semver = {
  valid: (value) => (/^\d+\.\d+\.\d+$/u.test(value) ? value : null),
  validRange: (value) => value,
  satisfies: () => true,
};

test("review: configured package omission cannot disappear behind a peer-inclusive graph", () => {
  assert.throws(() =>
    planFeatureAdvisories(
      [inventory([item("alpha"), item("beta")], [item("alpha")])],
      semver,
    ),
  );
});

test("review: same location with a different configured identity cannot become coverage", () => {
  assert.throws(() =>
    planFeatureAdvisories(
      [inventory([item("alpha", "1.2.3")], [item("alpha", "2.0.0")])],
      semver,
    ),
  );
});

test("review: selected versions must validate even when the server returns no advisories", () => {
  const plan = {
    payload: { alpha: ["1.2.3+"] },
    selected: [],
    local: [],
    wholeRepositoryCoverage: false,
  };
  const semver = {
    valid: () => null,
    validRange: () => null,
    satisfies: () => false,
  };
  assert.throws(() => evaluateFeatureAdvisories(plan, {}, semver));
});

test("review: the network boundary rejects a whole-lock shape before invoking fetch", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  await assert.rejects(() =>
    fetchFeatureAdvisories(
      {
        lockfileVersion: 3,
        packages: { "node_modules/unrelated": { version: "1.0.0" } },
      },
      semver,
      fakeFetch,
    ),
  );
  assert.equal(calls, 0);
});

test("review: duplicate response package keys cannot overwrite a vulnerability with an empty list", async () => {
  const raw =
    '{"alpha":[{"id":1,"name":"alpha","severity":"high","title":"Finding","url":"https://github.com/advisories/GHSA-example","vulnerable_versions":"*"}],"alpha":[]}';
  const fakeFetch = async () =>
    new Response(raw, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  await assert.rejects(() =>
    fetchFeatureAdvisories({ alpha: ["1.2.3"] }, semver, fakeFetch),
  );
});

for (const [name, raw] of [
  ["nested advisory fields", '{"alpha":[{"id":1,"id":2}]}'],
  ["escaped package names", '{"alpha":[],"\\u0061lpha":[]}'],
]) {
  test(`review: rejects duplicate ${name}`, async () => {
    const fakeFetch = async () =>
      new Response(raw, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(
      () => fetchFeatureAdvisories({ alpha: ["1.2.3"] }, semver, fakeFetch),
      /duplicate advisory JSON key/u,
    );
  });
}

test("review: repeated fields in distinct advisory objects are not duplicate keys", async () => {
  const response = {
    alpha: [
      { id: 1, title: 'Finding {"escaped":true}' },
      { id: 2, title: 'Another finding with \\ and " punctuation' },
    ],
  };
  const fetched = await fetchFeatureAdvisories(
    { alpha: ["1.2.3"] },
    semver,
    async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  assert.deepEqual(fetched.response, response);
});
