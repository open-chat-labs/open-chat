#!/usr/bin/env node
// Offline parent-API proof for the scoped sharp security override. No models/inference are loaded.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontend = path.resolve(
  process.argv[2] ?? fileURLToPath(new URL("../frontend", import.meta.url)),
);
const requireFrontend = createRequire(path.join(frontend, "package.json"));
const parentEntry = requireFrontend.resolve("@huggingface/transformers");
const parentDir = path.dirname(path.dirname(parentEntry));
const requireParent = createRequire(parentEntry);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(parentDir, "package.json"))).version,
  "4.2.0",
);
const sharp = requireParent("sharp");
assert.equal(
  sharp.versions.sharp,
  "0.35.3",
  "Review the image API contract before changing the override",
);
assert.equal(
  sharp.versions.vips,
  "8.18.3",
  "Use the patched prebuilt libvips, not an older global installation",
);
// Import the actual Node package entry; its RawImage implementation imports the installed sharp.
const { RawImage, env } = await import(
  pathToFileURL(path.join(parentDir, "dist/transformers.node.mjs")).href
);
assert.equal(env.version, "4.2.0");
env.allowRemoteModels = false;
env.allowLocalModels = false;
env.useFSCache = false;
const fixtureRoot = fs.mkdtempSync(
  path.join(path.resolve(process.argv[3] ?? os.tmpdir()), "openchat-sharp-"),
);
let checks = 0;
const check = (image, width, height, channels, expected) => {
  assert.equal(image.width, width);
  assert.equal(image.height, height);
  assert.equal(image.channels, channels);
  assert.equal(image.data.length, width * height * channels);
  if (expected) assert.deepEqual(Array.from(image.data), Array.from(expected));
  checks++;
};
try {
  for (const channels of [1, 3, 4]) {
    const data = Uint8ClampedArray.from(
      { length: 6 * 4 * channels },
      (_, index) => (index * 17 + 31) % 256,
    );
    const original = new RawImage(data, 6, 4, channels);
    let pngPipeline = original.toSharp();
    if (channels === 1) pngPipeline = pngPipeline.toColourspace("b-w");
    const png = await pngPipeline.png().toBuffer();
    const decoded = await RawImage.fromBlob(
      new Blob([png], { type: "image/png" }),
    );
    check(decoded, 6, 4, channels, data);
    const cropped = await original.crop([1, 1, 3, 2]);
    const expectedCrop = [];
    for (let y = 1; y <= 2; y++)
      for (let x = 1; x <= 3; x++)
        expectedCrop.push(
          ...data.slice((y * 6 + x) * channels, (y * 6 + x + 1) * channels),
        );
    check(cropped, 3, 2, channels, expectedCrop);
    check(await original.pad([1, 2, 3, 4]), 9, 11, channels);
    check(await original.center_crop(4, 2), 4, 2, channels);
    check(await original.center_crop(8, 6), 8, 6, channels);
    // Transformers 4.2.0's mixed pad/crop branch fails on both sharp 0.34.5 and 0.35.3.
    // Keep this pre-existing limitation explicit; do not mistake it for a successful transform.
    await assert.rejects(
      original.center_crop(4, 6),
      /extract_area: bad extract area/,
    );
    checks++;
    for (const resample of ["nearest", "bilinear", "bicubic", "lanczos"]) {
      check(await original.resize(3, 2, { resample }), 3, 2, channels);
    }
    check(await original.resize(3, null), 3, 2, channels);
    const saved = path.join(fixtureRoot, `roundtrip-${channels}.png`);
    await original.save(saved);
    const roundtrip = await RawImage.read(saved);
        // Saving grayscale without an explicit colourspace yields RGB, as in sharp 0.34.5.
    const savedChannels = channels === 1 ? 3 : channels;
    check(
      roundtrip,
      6,
      4,
      savedChannels,
      channels === 1
        ? Array.from(data).flatMap((value) => [value, value, value])
        : data,
    );
  }
  // Exercise supported byte decoders, including formats mentioned by the upstream libvips advisory.
  for (const format of ["jpeg", "webp", "gif", "tiff", "avif"]) {
    const encoded = await sharp({
      create: { width: 8, height: 6, channels: 3, background: "#306090" },
    })
      .toFormat(format)
      .toBuffer();
    const decoded = await RawImage.fromBlob(new Blob([encoded]));
    assert.equal(decoded.width, 8);
    assert.equal(decoded.height, 6);
    assert.ok([3, 4].includes(decoded.channels));
    checks++;
  }
  await assert.rejects(
    RawImage.fromBlob(new Blob([new Uint8Array([0, 1, 2, 3])])),
    /unsupported image format/i,
  );
  checks++;
  console.log(
    `Transformers 4.2.0 / sharp 0.35.3 / libvips 8.18.3 compatibility: ${checks} checks passed (offline; no models or inference)`,
  );
} finally {
  assert.equal(path.basename(fixtureRoot).startsWith("openchat-sharp-"), true);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
