import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  releaseCheckContext,
  latestSuccessfulRun,
  assertSuccessfulJobs,
  verifyHostedChecks,
  requiredWorkflows,
} from "./android_release_checks.mjs";

const context = { repository: "example/chat", sha: "a".repeat(40) };
const run = (workflow = "frontend.yaml", changes = {}) => ({
  id: 42,
  run_number: 3,
  run_attempt: 1,
  head_sha: context.sha,
  path: `.github/workflows/${workflow}`,
  repository: { full_name: context.repository },
  head_repository: { full_name: context.repository },
  event: "push",
  status: "completed",
  conclusion: "success",
  ...changes,
});
const page = (...runs) => ({ total_count: runs.length, workflow_runs: runs });
const jobPage = (changes = {}) => ({
  total_count: 1,
  jobs: [
    {
      run_id: 42,
      head_sha: context.sha,
      status: "completed",
      conclusion: "success",
      ...changes,
    },
  ],
});

test("context binds the release to exact checkout SHA and supported GitHub origin", () => {
  const env = {
    GITHUB_REPOSITORY: context.repository,
    GITHUB_SHA: context.sha,
    GITHUB_API_URL: "https://api.github.com",
  };
  assert.deepEqual(releaseCheckContext(env, context.sha), context);
  for (const changes of [
    { GITHUB_REPOSITORY: "../elsewhere" },
    { GITHUB_API_URL: "https://other.example" },
    { GITHUB_SHA: "bad" },
  ])
    assert.throws(() =>
      releaseCheckContext({ ...env, ...changes }, context.sha),
    );
  assert.throws(() => releaseCheckContext(env, "b".repeat(40)));
});

test("latest attempt must pass; an older green run cannot mask a queued/failed rerun", () => {
  assert.equal(
    latestSuccessfulRun(page(run()), "frontend.yaml", context).id,
    42,
  );
  assert.throws(() =>
    latestSuccessfulRun(
      page(
        run(),
        run("frontend.yaml", {
          id: 43,
          run_number: 4,
          status: "queued",
          conclusion: null,
        }),
      ),
      "frontend.yaml",
      context,
    ),
  );
  assert.throws(() =>
    latestSuccessfulRun(
      page(
        run(),
        run("frontend.yaml", {
          run_attempt: 2,
          conclusion: "failure",
        }),
      ),
      "frontend.yaml",
      context,
    ),
  );
});

for (const changes of [
  { head_sha: "b".repeat(40) },
  { path: ".github/workflows/same-display-name.yaml" },
  { repository: { full_name: "other/chat" } },
  { head_repository: { full_name: "other/chat" } },
  { event: "pull_request" },
  { event: "pull_request_target" },
  { run_attempt: 0 },
  { conclusion: "skipped" },
  { conclusion: "neutral" },
  { conclusion: "failure" },
  { status: "in_progress" },
]) {
  test(`rejects untrusted/incomplete run evidence ${JSON.stringify(changes)}`, () => {
    assert.throws(() =>
      latestSuccessfulRun(
        page(run("frontend.yaml", changes)),
        "frontend.yaml",
        context,
      ),
    );
  });
}

test("missing and truncated workflow evidence fails closed", () => {
  for (const payload of [
    {},
    page(),
    { total_count: 101, workflow_runs: [run()] },
    { total_count: 2, workflow_runs: [run()] },
  ]) {
    assert.throws(() => latestSuccessfulRun(payload, "frontend.yaml", context));
  }
});

test("success requires every job, not an entirely skipped workflow", () => {
  assertSuccessfulJobs(jobPage(), run(), context);
  for (const changes of [
    { conclusion: "skipped" },
    { conclusion: "failure" },
    { run_id: 9 },
    { head_sha: "b".repeat(40) },
    { status: "queued" },
  ]) {
    assert.throws(() => assertSuccessfulJobs(jobPage(changes), run(), context));
  }
  assert.throws(() =>
    assertSuccessfulJobs({ total_count: 0, jobs: [] }, run(), context),
  );
});

test("fetches exact workflow paths and attempt jobs using bounded read-only requests", async () => {
  const calls = [];
  const results = await verifyHostedChecks(
    context,
    "test-token",
    async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal);
      assert.equal(options.headers.Authorization, "Bearer test-token");
      if (url.includes("/attempts/1/jobs?"))
        return { ok: true, json: async () => jobPage() };
      const name = url.match(/\/workflows\/([^/]+)\/runs\?/u)?.[1];
      assert.ok(requiredWorkflows.includes(name));
      assert.ok(url.endsWith(`head_sha=${context.sha}&per_page=100`));
      return { ok: true, json: async () => page(run(name)) };
    },
  );
  assert.equal(calls.length, 8);
  assert.equal(results.length, 4);
});

test("API failures or missing authentication never become a pass", async () => {
  await assert.rejects(
    verifyHostedChecks(context, "", async () => assert.fail("must not fetch")),
  );
  await assert.rejects(
    verifyHostedChecks(context, "test-token", async () => ({
      ok: false,
      status: 403,
    })),
    /HTTP 403/u,
  );
  await assert.rejects(
    verifyHostedChecks(context, "test-token", async () => {
      throw new Error("network unavailable");
    }),
  );
});

test("Android build and upload are preceded by prerequisite checks", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/android_release.yaml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /actions: read/u);
  assert.match(
    workflow,
    /node --test scripts\/android_release_policy.test.mjs scripts\/android_release_checks.test.mjs/u,
  );
  assert.ok(
    workflow.indexOf("run: node scripts/android_release_checks.mjs") <
      workflow.indexOf("- name: Require configured release signing"),
  );
  const recheck = workflow.indexOf(
    "- name: Recheck exact-source release prerequisites",
  );
  assert.ok(workflow.indexOf("- name: Build Android AAB (Store)") > 0);
  assert.ok(recheck > workflow.indexOf("- name: Build Android AAB (Store)"));
  assert.ok(
    recheck > workflow.indexOf("android_release_policy.mjs verify-aab"),
  );
  assert.ok(recheck < workflow.indexOf("- name: Upload build artifacts"));
});
