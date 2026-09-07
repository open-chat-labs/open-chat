import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import {
  artifactUrl,
  manifestPath,
  resolveTools,
  validateManifest,
} from "./android_component_identity_tools.mjs";

const reviewed = JSON.parse(await readFile(manifestPath, "utf8"));
const payload = new TextEncoder().encode("synthetic jar fixture");
const fixtures = () => ({
  ...structuredClone(reviewed),
  artifacts: reviewed.artifacts.map((artifact) => ({
    ...artifact,
    bytes: payload.length,
    sha256: createHash("sha256").update(payload).digest("hex"),
  })),
});
const directory = async () =>
  join(await mkdtemp(join(tmpdir(), "android-tools-offline-")), "fresh");
function response(url, options = {}) {
  return {
    status: 200,
    redirected: false,
    url,
    headers: new Headers(),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    }),
    ...options,
  };
}

test("manifest preserves the locally compiled nine-artifact versions and exact classpaths", () => {
  validateManifest(reviewed);
  assert.deepEqual(
    reviewed.artifacts.map(
      ({ group, artifact, version }) => `${group}:${artifact}:${version}`,
    ),
    [
      "org.jetbrains.kotlin:kotlin-compiler-embeddable:2.2.0",
      "org.jetbrains.kotlin:kotlin-stdlib:2.2.0",
      "org.jetbrains.kotlin:kotlin-script-runtime:2.2.0",
      "org.jetbrains.kotlin:kotlin-daemon-embeddable:2.2.0",
      "org.jetbrains.kotlin:kotlin-reflect:1.6.10",
      "org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.8.0",
      "org.jetbrains:annotations:13.0",
      "junit:junit:4.13.2",
      "org.hamcrest:hamcrest-core:1.3",
    ],
  );
  assert.deepEqual(
    reviewed.classpaths.compiler,
    reviewed.artifacts.slice(0, 7).map(({ artifact }) => artifact),
  );
  assert.deepEqual(reviewed.classpaths.runtime, [
    "kotlin-stdlib",
    "annotations",
  ]);
  assert.deepEqual(reviewed.classpaths.junit, ["junit", "hamcrest-core"]);
  assert.match(reviewed.verification, /official Maven Central .jar.sha1/u);
});

test("offline synthetic bodies produce only the pinned classpaths after all nine verified downloads", async () => {
  const output = await directory();
  const calls = [];
  const result = await resolveTools({
    directory: output,
    manifest: fixtures(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      assert.deepEqual(Object.keys(options).sort(), [
        "credentials",
        "redirect",
        "signal",
      ]);
      assert.equal(options.credentials, "omit");
      assert.equal(options.redirect, "error");
      return response(url);
    },
  });
  assert.deepEqual(
    calls.map(({ url }) => url),
    reviewed.artifacts.map(artifactUrl),
  );
  assert.ok(calls.every(({ options }) => options.signal.aborted));
  for (const [kind, names] of Object.entries(reviewed.classpaths)) {
    assert.deepEqual(
      result[`${kind}Classpath`].split(delimiter),
      names.map((name) => {
        const artifact = reviewed.artifacts.find(
          (entry) => entry.artifact === name,
        );
        return join(output, `${name}-${artifact.version}.jar`);
      }),
    );
  }
  assert.equal((await readdir(output)).length, 9);
  for (const path of result.junitClasspath.split(delimiter))
    assert.deepEqual(await readFile(path), Buffer.from(payload));
  await assert.rejects(
    resolveTools({
      directory: output,
      manifest: fixtures(),
      fetchImpl: () => {
        throw new Error("must not fetch");
      },
    }),
    /EEXIST/u,
  );
});

for (const [label, field, value] of [
  ["path traversal", "group", "org../escape"],
  ["URL injection", "artifact", "https://other.invalid/jar"],
  ["query injection", "version", "2.2.0?token=x"],
  ["snapshot version", "version", "2.2.0-SNAPSHOT"],
  ["encoded path", "group", "org%2fescape"],
]) {
  test(`manifest rejects ${label} before writing or fetching`, async () => {
    const manifest = fixtures();
    manifest.artifacts[0][field] = value;
    const output = await directory();
    await assert.rejects(
      resolveTools({
        directory: output,
        manifest,
        fetchImpl: () => {
          throw new Error("must not fetch");
        },
      }),
      { name: "AssertionError" },
    );
    await assert.rejects(readdir(output), /ENOENT/u);
  });
}

test("manifest rejects duplicate, missing, oversized and unpinned tools", () => {
  for (const mutate of [
    (manifest) => {
      manifest.artifacts.pop();
    },
    (manifest) => {
      manifest.artifacts[1] = manifest.artifacts[0];
    },
    (manifest) => {
      manifest.artifacts[0].bytes = 60_000_001;
    },
    (manifest) => {
      manifest.artifacts[0].sha256 = "unverified";
    },
    (manifest) => {
      manifest.classpaths.runtime.push("unlisted");
    },
  ]) {
    const manifest = fixtures();
    mutate(manifest);
    assert.throws(() => validateManifest(manifest));
  }
});

for (const [label, replacement, expected] of [
  ["redirect", { redirected: true }, /redirect/u],
  ["other origin", { url: "https://other.invalid/tool.jar" }, /origin\/path/u],
  [
    "different path",
    { url: `${artifactUrl(reviewed.artifacts[0])}?mirror=1` },
    /origin\/path/u,
  ],
  ["HTTP failure", { status: 404 }, /unexpected response/u],
  [
    "wrong declared size",
    { headers: new Headers({ "content-length": "99999" }) },
    /content length/u,
  ],
  ["bodyless response", { body: null }, /body missing/u],
]) {
  test(`download fails closed on ${label}, aborts and makes no next request`, async () => {
    let calls = 0;
    let signal;
    const output = await directory();
    await assert.rejects(
      resolveTools({
        directory: output,
        manifest: fixtures(),
        fetchImpl: async (url, options) => {
          calls += 1;
          signal = options.signal;
          return response(url, replacement);
        },
      }),
      expected,
    );
    assert.equal(calls, 1);
    assert.equal(signal.aborted, true);
    assert.deepEqual(await readdir(output), []);
  });
}

for (const [label, body, expected] of [
  ["oversized", new Uint8Array(payload.length + 1), /exceeds pinned size/u],
  ["truncated", new Uint8Array(payload.length - 1), /truncated/u],
  ["corrupt", new Uint8Array(payload.length), /SHA-256 mismatch/u],
]) {
  test(`streamed ${label} body is never promoted to a JAR`, async () => {
    const output = await directory();
    let calls = 0;
    await assert.rejects(
      resolveTools({
        directory: output,
        manifest: fixtures(),
        fetchImpl: async (url) => {
          calls += 1;
          return response(url, {
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(body);
                controller.close();
              },
            }),
          });
        },
      }),
      expected,
    );
    assert.equal(calls, 1);
    assert.ok((await readdir(output)).every((name) => name.endsWith(".part")));
  });
}

for (const phase of ["headers", "body"]) {
  test(`deadline covers stalled ${phase}, including a fetch mock that ignores abort`, async () => {
    let signal;
    let cancelled = false;
    await assert.rejects(
      resolveTools({
        directory: await directory(),
        manifest: fixtures(),
        timeoutMs: 20,
        fetchImpl: async (url, options) => {
          signal = options.signal;
          if (phase === "headers") return new Promise(() => {});
          return response(url, {
            body: new ReadableStream({
              cancel() {
                cancelled = true;
              },
            }),
          });
        },
      }),
      /deadline/u,
    );
    assert.equal(signal.aborted, true);
    if (phase === "body") assert.equal(cancelled, true);
  });
}

test("redirected output ancestors and non-absolute outputs are rejected before fetch", async () => {
  const actual = await mkdtemp(join(tmpdir(), "android-tools-target-"));
  const parent = await mkdtemp(join(tmpdir(), "android-tools-link-"));
  const link = join(parent, "redirected");
  await symlink(
    actual,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  for (const output of [join(link, "fresh"), "relative-output"]) {
    await assert.rejects(
      resolveTools({
        directory: output,
        manifest: fixtures(),
        fetchImpl: () => {
          throw new Error("must not fetch");
        },
      }),
      /output/u,
    );
  }
});
