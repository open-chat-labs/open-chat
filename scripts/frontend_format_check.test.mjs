import assert from "node:assert/strict";
import test from "node:test";
import {
  checkFrontendFormatting,
  formatArgumentBatches,
} from "./frontend_format_check.mjs";

test("format batches preserve every path exactly once within the Windows argument budget", () => {
  const paths = Array.from(
    { length: 284 },
    (_, i) => `app/src/${"nested/".repeat(20)}file ${i} & literal.svelte`,
  );
  const batches = formatArgumentBatches(paths);
  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat(), paths);
  assert.ok(
    batches.every(
      (batch) => batch.reduce((n, path) => n + 2 * path.length + 3, 0) <= 16000,
    ),
  );
  assert.deepEqual(formatArgumentBatches([]), []);
  assert.throws(() => formatArgumentBatches(["x".repeat(9000)]), /exceeds/);
});

test("formatter uses the installed CLI without a shell and preserves every failure", () => {
  const paths = Array.from(
    { length: 200 },
    (_, i) => `${"long/".repeat(50)}${i}.ts`,
  );
  const batches = formatArgumentBatches(paths);
  const seen = [];
  const errors = checkFrontendFormatting(
    "fixture frontend",
    paths,
    (command, args, options) => {
      assert.equal(command, process.execPath);
      assert.ok(args[0].endsWith("prettier.cjs"));
      assert.equal(args[1], "--plugin=prettier-plugin-svelte");
      assert.equal(args[2], "--check");
      assert.equal(options.shell, undefined);
      seen.push(...args.slice(3));
      return { status: 1, stdout: "format failed", stderr: "details" };
    },
  );
  assert.deepEqual(seen, paths);
  assert.equal(errors.length, batches.length);
  assert.ok(
    errors.every(
      (error) => error.includes("format failed") && error.includes("details"),
    ),
  );
});

test("spawn errors and signals cannot become successful format checks", () => {
  for (const result of [
    { error: new Error("missing executable") },
    { status: null },
    { status: 2 },
  ]) {
    assert.equal(
      checkFrontendFormatting("fixture", ["test.ts"], () => result).length,
      1,
    );
  }
  assert.deepEqual(
    checkFrontendFormatting("fixture", ["test.ts"], () => ({ status: 0 })),
    [],
  );
});
