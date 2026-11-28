import { defineConfig } from "@playwright/test";
import { localUrl } from "../config/local.mjs";

// Signs up the seed snapshot's pool of users (replica/seed.mjs runs it)
export default defineConfig({
    testDir: ".",
    testMatch: /pool\.seed\.ts/,
    timeout: 180_000,
    fullyParallel: true,
    workers: Number(process.env.OC_E2E_WORKERS ?? 3),
    // a failed sign-up is tried again, so one stall doesn't cost the whole seed
    retries: 2,
    reporter: "line",
    outputDir: "../results/seed",
    use: { baseURL: localUrl(process.env.OC_E2E_URL!), browserName: "chromium" },
});
