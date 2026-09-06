# Local-model upstream reconciliation

Assessment: 2026-09-06. This records local source validation, not release approval.

The model-only `9450765ec` candidate was reconciled with upstream
`df9d9ed52db00e87fbb7309280a325902c9bb2cc`. The merge retains the pinned model
artifacts and runtimes, optional audio, explicit WebGPU selection, download
identity checks and generic anonymous bounded media transport. No application
business schema or automatic inference-provider fallback was introduced.

## Merge-specific checks

- Both UI composers retain model capture and stale-result guards alongside
  upstream lazy editors, contextual attachments and wallet approval sequencing.
- Bootstrap executes only the selected lazy UI tree. Shared web-model restoration
  does not block mounting and also covers explicitly enabled Android WebGPU.
- Development and production emit the video-transcoding worker as well as the
  independently gated model worker. Failed worker builds cannot advance the
  selected model runtime generation.
- Generated native permission documentation and schema agree with all 31 commands.
  Upstream protected-action methods are preserved; obsolete direct destruction
  dispatch was not restored.
- The exact merged frontend lock installs 1,401 packages. It preserves all local
  dependency records and adds nine upstream records; no model runtime pin changed.
- Windows Node 24.14.1: 119 suites / 1,367 frontend tests pass with `CI=true`.
  Cold-import timeout failures were retained as evidence and corrected with
  narrow test isolation and a genuine type-only video import; no timeout increase
  or skipped test was used.
- The actual Android shell script has a failure-path regression: failed bundling
  cannot fall through to copying over an existing build. Its CI Node pin matches
  the model build's reviewed Node 24.18.1 prerequisite.

## Remaining boundaries

Production build evidence from before this upstream merge must not be attributed
to the merged tree. The merged native builds, updated source's hosted checks,
fresh dependency review and physical-device inference acceptance remain required.

APK work is for local testing only, not store publishing. Upstream changed the
default Android package identity. Do not install it as an update to an existing
local package without proving identity, certificate and retained-data compatibility.
Keep the local APK on bundled assets with OTA disabled. The inherited OTA loader's
handling of nested model assets still needs separate work before WebGPU OTA use.
