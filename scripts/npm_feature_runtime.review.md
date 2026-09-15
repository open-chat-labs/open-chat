# Scoped npm collector runtime review — 2026-09-15

The supported tuple is Node 24.18.1, npm 11.16.0, Arborist 9.7.0, semver 7.8.1.
This updates collector tooling only, not frontend dependency locks or feature roots.
The prior 9.4.0/7.7.4 assertions were incompatible with the selected CI Node bundle.

Primary sources are the [Node bundled npm manifest](https://github.com/nodejs/node/blob/v24.18.1/deps/npm/package.json),
[npm exact lock](https://github.com/npm/cli/blob/v11.16.0/package-lock.json), and
[Arborist changelog](https://github.com/npm/cli/blob/v11.16.0/workspaces/arborist/CHANGELOG.md).
The official Node Windows archive used for independent local execution has SHA-256
`ec56b84a7551893ab2324ebdfdc4ab974a63b4781162600b68a1293cc3e53765`.
Runtime source pins in `npm_feature_runtime.mjs` normalize CRLF to LF for platform parity.
They cover seven reviewed graph-semantic files, not every npm dependency or all runtime code.

## Bounded 9.4.0 to 9.7.0 source comparison

- `load-virtual.js`, `edge.js`, and `dep-valid.js` are LF-byte-identical.
  `loadVirtual` requires an existing lock, builds Nodes and Links from its package records,
  rejects absent link targets and reloads local target manifests. No ideal-tree construction,
  install, audit, lock save or network operation is requested by the collector.
- `node.js` changes only constructor property ordering. Dependency precedence remains peer,
  production, optional, then development for eligible local top nodes; workspace edges retain
  precedence. Source-reference/global-top modes remain rejected. The collector still compares
  every selected node's complete outgoing edge names, types and raw specifications to source.
- `link.js` adds propagation of overrides to a target only when a rule names a target dependency.
  Real-engine fixtures verify matching override propagation and unrelated-rule noninterference.
  Locked package identity, local manifest and before/after input checks remain mandatory.
- `override-set.js` now finds a common ancestor for compatible sibling override sets while
  preserving conflicting-rule rejection. Real class fixtures exercise both paths.
- `shrinkwrap.js` changes `commit()` to omit stale workspace/inert incomplete optional records.
  The collector does not invoke `commit()` or save. Missing required or optional-platform lock
  targets still fail; only genuinely absent optional peers may be omitted.

`npm_feature_runtime_smoke.mjs` executes these actual-engine cases and the complete source-bound
`--mode plan` path. It rejects query mode, blocks socket connections/fetch and mutable Arborist
entrypoints, and records zero forbidden calls alongside the real tool/source identities.
It separately checks legacy-peer and peer-inclusive reachability, invalid peer diagnostics,
optional peers, local development/optional edges and exclusion of an unrelated root dependency.
Pure fixture tests do not stand in for this real-runtime command. Neither result grants an
advisory verdict, package exploitability assessment, source-root expansion or release approval.

Early main-runner failure writes only an allowlisted stage/mode/scope and whether a query was
attempted. No arbitrary exception, local path, environment value or selected package is emitted.
