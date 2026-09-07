import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const main = readFileSync(resolve(import.meta.dirname, "main.ts"), "utf8");
const openchat = readFileSync(
    resolve(import.meta.dirname, "../../openchat-client/src/openchat.ts"),
    "utf8",
);
const workerAgent = readFileSync(
    resolve(import.meta.dirname, "../../openchat-client/src/workerAgent.ts"),
    "utf8",
);
const desktopApp = readFileSync(resolve(import.meta.dirname, "components/App.svelte"), "utf8");
const mobileApp = readFileSync(
    resolve(import.meta.dirname, "components_mobile/App.svelte"),
    "utf8",
);
const desktopHomeRoute = readFileSync(
    resolve(import.meta.dirname, "components/home/HomeRoute.svelte"),
    "utf8",
);
const mobileHomeRoute = readFileSync(
    resolve(import.meta.dirname, "components_mobile/home/HomeRoute.svelte"),
    "utf8",
);

describe("browser startup service-worker maintenance", () => {
    it("finishes bounded development cleanup before mounting either application tree", () => {
        const preparation = main.indexOf("await prepareServiceWorkerBeforeApplicationStart()");
        const mobileImport = main.indexOf('import("./components_mobile/App.svelte")');
        const desktopImport = main.indexOf('import("./components/App.svelte")');
        const appMount = main.indexOf("mount(App,");

        expect(preparation).toBeGreaterThan(-1);
        expect(mobileImport).toBeGreaterThan(preparation);
        expect(desktopImport).toBeGreaterThan(preparation);
        expect(appMount).toBeGreaterThan(mobileImport);
        expect(appMount).toBeGreaterThan(desktopImport);
    });

    it("renders actionable recovery without booting either app when controller release fails", () => {
        const preparation = main.indexOf("await prepareServiceWorkerBeforeApplicationStart()");
        const failureMount = main.indexOf("mount(StartupFailure");
        const restore = main.indexOf("ensureWebModelRestored()");
        const mobileImport = main.indexOf('import("./components_mobile/App.svelte")');
        const desktopImport = main.indexOf('import("./components/App.svelte")');
        const appMount = main.indexOf("mount(App,");

        expect(main).toContain('recovery: "new-tab"');
        expect(main).toContain("fresh tab");
        expect(failureMount).toBeGreaterThan(preparation);
        expect(restore).toBeGreaterThan(failureMount);
        expect(mobileImport).toBeGreaterThan(failureMount);
        expect(desktopImport).toBeGreaterThan(failureMount);
        expect(appMount).toBeGreaterThan(mobileImport);
        expect(appMount).toBeGreaterThan(desktopImport);
    });

    it("restores the web model for browser and feature-flagged Android WebGPU clients", () => {
        expect(main).toContain("if (usesWebInferenceRuntime()) void ensureWebModelRestored()");
        expect(main).toContain("if (!nativeClient)");
    });

    it("uses the shared compositor-friendly spinner for both startup routes", () => {
        for (const homeRoute of [desktopHomeRoute, mobileHomeRoute]) {
            expect(homeRoute).toContain('import Loading from "@shared_components/Loading.svelte"');
            expect(homeRoute).toContain('<Loading size={"small"} />');
            expect(homeRoute).not.toContain("FancyLoader");
            expect(homeRoute).not.toContain("<canvas");
        }
    });

    it("surfaces an authentication-worker startup failure instead of leaving the loader forever", () => {
        expect(workerAgent).toContain("WORKER_STARTUP_REQUEST_TIMEOUT_MS");
        expect(workerAgent).toContain("worker.onerror");
        expect(workerAgent).toContain("worker.onmessageerror");
        expect(workerAgent).toContain(
            'this.#failWorker(workerFailure(error, "OpenChat worker could not be created"))',
        );
        expect(workerAgent).toContain(
            'const failure = workerFailure(error, "OpenChat worker request could not be sent")',
        );
        expect(workerAgent).toContain("this.#failWorker(failure)");
        expect(openchat).toContain("startupErrorStore.set(");
        expect(openchat).toContain("#handleStartupFailure");
        expect(desktopApp).toContain("$startupErrorStore");
        expect(mobileApp).toContain("$startupErrorStore");
    });

    it("routes a fatal background-worker crash to the same reload UI after startup", () => {
        expect(openchat).toContain(
            "new WorkerAgent(config, (error) => this.#handleStartupFailure(error))",
        );
        expect(workerAgent).toContain("this.#onFatalError?.(error)");
        expect(openchat).toContain("if (startupErrorStore.value !== undefined) return");
        for (const app of [desktopApp, mobileApp]) {
            const appRoot = app.indexOf("<svelte:boundary");
            const recoveryGuard = app.indexOf("{#if $startupErrorStore !== undefined}");
            const recovery = app.indexOf("<StartupFailure", recoveryGuard);
            const identityGate = app.indexOf('$identityStateStore.kind === "anon"', recovery);
            const i18nGate = app.indexOf("{#if !$isLoading", recovery);

            expect(recoveryGuard).toBeGreaterThan(appRoot);
            expect(recovery).toBeGreaterThan(recoveryGuard);
            expect(identityGate).toBeGreaterThan(recovery);
            expect(i18nGate).toBeGreaterThan(recovery);
        }
        expect(desktopHomeRoute).not.toContain("startupErrorStore");
        expect(mobileHomeRoute).not.toContain("startupErrorStore");
        expect(desktopHomeRoute).not.toContain("StartupFailure");
        expect(mobileHomeRoute).not.toContain("StartupFailure");
    });
});
