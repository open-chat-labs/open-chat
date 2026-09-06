import { createHash } from "node:crypto";

function lockPackages(bytes, label) {
  const sections = bytes.toString("utf8").split(/^\[\[package\]\][ \t]*\r?$/mu);
  if (sections.length < 2 || !/^version = [34][ \t]*\r?$/mu.test(sections[0])) {
    throw new Error(`${label}: expected a Cargo v3/v4 lockfile with packages`);
  }
  const packages = new Map();
  for (const section of sections.slice(1)) {
    const field = (name, required = false) => {
      const matches = [
        ...section.matchAll(new RegExp(`^${name} = (.+?)\\r?$`, "gmu")),
      ];
      if (matches.length > 1 || (required && matches.length !== 1)) {
        throw new Error(`${label}: invalid or duplicate package ${name}`);
      }
      if (!matches.length) return undefined;
      let value;
      try {
        value = JSON.parse(matches[0][1]);
      } catch {
        throw new Error(`${label}: unsupported package ${name} encoding`);
      }
      if (typeof value !== "string" || !value.length) {
        throw new Error(`${label}: invalid package ${name}`);
      }
      return value;
    };
    const name = field("name", true);
    const version = field("version", true);
    const source = field("source");
    const checksum = field("checksum");
    if (
      source?.startsWith("registry+") &&
      !/^[a-f0-9]{64}$/u.test(checksum ?? "")
    ) {
      throw new Error(
        `${label}: missing/invalid registry checksum for ${name}@${version}`,
      );
    }
    const identity = JSON.stringify([name, version, source ?? null]);
    if (packages.has(identity))
      throw new Error(`${label}: duplicate package ${identity}`);
    packages.set(identity, { name, version, source, checksum });
  }
  return packages;
}

/**
 * An isolated SBOM root legitimately prunes unrelated workspace packages and adds
 * itself. It must not resolve new versions, sources or checksums while doing so.
 * This proves lock identity, not advisory acceptance or complete SBOM coverage.
 */
export function assertSbomLockIdentity(sourceLock, isolatedLock) {
  const source = lockPackages(sourceLock, "source lock");
  const isolated = lockPackages(isolatedLock, "isolated SBOM lock");
  const syntheticRoot = JSON.stringify([
    "openchat-pr1-model-sbom",
    "0.0.0",
    null,
  ]);
  let externalPackages = 0;
  for (const [identity, actual] of isolated) {
    if (identity === syntheticRoot && actual.checksum === undefined) continue;
    const expected = source.get(identity);
    if (!expected || actual.checksum !== expected.checksum) {
      throw new Error(
        `SBOM dependency differs from source Cargo.lock: ${identity}`,
      );
    }
    if (actual.source !== undefined) externalPackages += 1;
  }
  if (!isolated.has(syntheticRoot) || externalPackages === 0) {
    throw new Error(
      "SBOM lock omits the isolated root or its external dependencies",
    );
  }
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  return {
    sourceLockSha256: digest(sourceLock),
    isolatedLockSha256: digest(isolatedLock),
    externalPackages,
  };
}
