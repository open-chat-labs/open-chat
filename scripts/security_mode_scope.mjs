const unscopedModes = new Set(["npm", "rust", "sbom"]);

// Interim fail-closed boundary: the existing audit/inventory implementations
// inspect broader dependencies than the requested model/app-card scope.
// Do not turn these modes back on without a reviewed scoped replacement.
export function securityModes(args, policyName) {
  if (policyName !== "pr1" && policyName !== "pr2") {
    throw new Error("Unknown security policy: " + policyName);
  }
  const allowed = new Set(["ci", "licenses"]);
  if (policyName === "pr1") allowed.add("format");
  if (args.length === 0 || args.some((mode) => unscopedModes.has(mode))) {
    throw new Error(
      "Unscoped audit/inventory disabled; scoped replacement required. " +
        "Select explicit offline modes only: " +
        [...allowed].join(", "),
    );
  }
  const unknown = args.filter((mode) => !allowed.has(mode));
  if (unknown.length) {
    throw new Error(
      "Unknown or unsupported security mode: " + JSON.stringify(unknown),
    );
  }
  return new Set(args);
}
