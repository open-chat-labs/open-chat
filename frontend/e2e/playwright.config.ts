import { defineConfig, devices } from "@playwright/test";
import { localUrl } from "./config/local.mjs";

// The new UI against a local replica (PRD #10550). By default the suite builds the app (the native
// build, which has both new trees) and serves it on its own port and caches, so a developer's running
// server is left alone. OC_E2E_DEV=true serves it from the Vite dev server instead, which picks up
// edits without a rebuild, for writing a spec. OC_E2E_URL points it at a server that's already
// running; it must have been started with OC_E2E=true.
const port = Number(process.env.OC_E2E_PORT ?? 5011);
const baseURL = localUrl(process.env.OC_E2E_URL ?? `http://localhost:${port}`);
const devServer = process.env.OC_E2E_DEV === "true";

export default defineConfig({
    testDir: "./specs",
    // sign-ups are real: each one creates a user canister on the replica
    timeout: 180_000,
    expect: { timeout: 30_000 },
    fullyParallel: true,
    // Every sign-up installs a user canister, which slows the local replica's other requests. Past a
    // few at once on a busy machine, they stall long enough to fail sign-up. OC_E2E_WORKERS overrides.
    workers: Number(process.env.OC_E2E_WORKERS ?? 3),
    retries: 0,
    reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
    outputDir: "results",
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        // src/web: a desktop viewport. A test for one tree only is tagged @desktop-only or @mobile-only, so
        // that `playwright test --list` (parity:ledger) shows where each test runs
        {
            name: "v3-desktop",
            use: { browserName: "chromium", viewport: { width: 1400, height: 900 } },
            grepInvert: /@mobile-only/,
        },
        // src/native in a phone's browser: touch, no hover, a phone's width
        { name: "v3-mobile", use: { ...devices["Pixel 7"] }, grepInvert: /@desktop-only/ },
    ],
    webServer: process.env.OC_E2E_URL
        ? undefined
        : {
              command: "npm run dev:native",
              cwd: "..",
              url: baseURL,
              // a build takes a few minutes
              timeout: 600_000,
              reuseExistingServer: true,
              env: {
                  OC_DEV_PORT: String(port),
                  OC_E2E: "true",
                  OC_E2E_BUNDLE: String(!devServer),
                  OC_VITE_CACHE_DIR: "node_modules/.vite-e2e",
              },
          },
});
