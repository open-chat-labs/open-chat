import { createHash } from "node:crypto";

export const RAW_DEPENDENCY_DIGEST = "sha256-raw-v1";
export const TEXT_DEPENDENCY_DIGEST = "sha256-utf8-lf-v1";

/**
 * Text-v1 changes CRLF to LF only. It preserves the BOM, lone CR, Unicode,
 * whitespace, ordering, and the presence/absence of a final newline. Invalid
 * UTF-8 fails rather than being silently replaced before security hashing.
 */
export function dependencyDigest(bytes, format = RAW_DEPENDENCY_DIGEST) {
  let content = bytes;
  if (format === TEXT_DEPENDENCY_DIGEST) {
    content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(bytes)
      .replaceAll("\r\n", "\n");
  } else if (format !== RAW_DEPENDENCY_DIGEST) {
    throw new Error(`Unsupported reviewed dependency digest format: ${format}`);
  }
  return createHash("sha256").update(content).digest("hex");
}

export function reviewedDependencyDigest(bytes, policy, path) {
  const format = policy.dependencyDigestMigration?.legacyRawFiles?.includes(
    path,
  )
    ? RAW_DEPENDENCY_DIGEST
    : (policy.reviewedDependencyDigestFormat ?? RAW_DEPENDENCY_DIGEST);
  return dependencyDigest(bytes, format);
}
