/* eslint-disable no-undef */
import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * We need to create two different bundles here:
 * One for the full version and one for the app store version
 * The difference is just in the OC_APP_STORE env var
 */

const CSP_META = /<meta http-equiv="Content-Security-Policy" content="[^"]*"/g;

// Swaps the website's CSP for the one the native shell needs. Throws rather than
// ship a zip whose CSP blocks asset.localhost, or one with no CSP at all.
export function withCsp(indexHtml, csp) {
    if (typeof csp !== "string" || csp.trim() === "") {
        throw new Error("No CSP to put in the OTA index.html");
    }
    const found = indexHtml.match(CSP_META)?.length ?? 0;
    if (found !== 1) {
        throw new Error(`Expected one CSP meta tag in index.html, found ${found}`);
    }
    return indexHtml.replace(
        CSP_META,
        () => `<meta http-equiv="Content-Security-Policy" content="${csp}"`,
    );
}

// The script has no CSP hash, so it only runs because it sits ahead of the CSP meta tag.
export function withOcConfig(indexHtml, store) {
    // This is the authoritative OTA strategy for anything delivered over the air.
    // The value compiled into a shell is only a default: `override` in
    // rollup.config.mjs emits `(window.OC_CONFIG?.KEY ?? <compiled>)`, and this
    // injection sets window.OC_CONFIG, so the zip wins from the first update
    // onwards. Changing OC_OTA_UPDATES in the Android workflow alone has no
    // effect past a client's first OTA.
    //
    // "minor" for the sideloaded channel, not "major": major marks a bundle an
    // installed shell cannot run, and taking one over the air is exactly the
    // failure this gate exists to prevent. See tauri-plugin-oc/OTA_UPDATES.md.
    const ota = store ? "patch" : "minor";
    const injection = `<script>window.OC_CONFIG={OC_MOBILE_LAYOUT:"v2", OC_APP_STORE: "${store}", OC_OTA_UPDATES: "${ota}"}</script>`;
    return indexHtml.replace("<head>", `<head>${injection}`);
}

export function androidBundlePlugin({ version, csp }) {
    return {
        name: "android-bundle",
        async writeBundle() {
            // Only create OTA zip bundles for web builds. When building the
            // APK/IPA directly (OC_APP_TYPE=android or ios) the zips are not
            // needed and would just bloat the app.
            if (process.env.OC_APP_TYPE === "android" || process.env.OC_APP_TYPE === "ios") {
                await fs.remove(path.join("build", "downloads"));
                return;
            }

            const buildDir = "build";
            const distBundleDir = "dist_bundle";
            const downloadDir = path.join(buildDir, "downloads");

            console.log(`Creating Android bundles`);

            try {
                // Ensure clean state
                await fs.remove(distBundleDir);
                await fs.ensureDir(distBundleDir);
                await fs.ensureDir(downloadDir);

                await fs.copy("public", distBundleDir);

                // Copy build/ but filter out downloads/
                await fs.copy(buildDir, distBundleDir, {
                    filter: (src) => !src.includes(path.join(buildDir, "downloads")),
                });

                // Remove assets not needed in Android bundle
                // TODO - we can and will revisit whether we need these assets in the bundle _at all_
                await fs.remove(path.join(distBundleDir, "assets", "screenshots")); // these are all used in the blog section
                await fs.remove(path.join(distBundleDir, "assets", "blog")); // the app doesn't render the blog
                await fs.remove(path.join(distBundleDir, "out")); // this is just ts definitions

                // Remove source maps
                const files = await fs.readdir(distBundleDir, { recursive: true });
                await Promise.all(
                    files
                        .filter((f) => f.endsWith(".map"))
                        .map((f) => fs.remove(path.join(distBundleDir, f))),
                );

                // Inject Android Config
                const indexHtmlPath = path.join(distBundleDir, "index.html");
                const indexHtml = withCsp(await fs.readFile(indexHtmlPath, "utf-8"), csp());

                await writeBundleZip(
                    indexHtmlPath,
                    indexHtml,
                    distBundleDir,
                    downloadDir,
                    version,
                    true,
                );
                await writeBundleZip(
                    indexHtmlPath,
                    indexHtml,
                    distBundleDir,
                    downloadDir,
                    version,
                    false,
                );

                console.log("Android bundle created successfully.");
            } catch (err) {
                console.error("Failed to create Android bundle:", err);
                throw err;
            } finally {
                await fs.remove(distBundleDir);
            }
        },
    };
}

async function writeBundleZip(
    indexHtmlPath,
    indexHtml,
    distBundleDir,
    downloadDir,
    version,
    store,
) {
    const zipFile = store
        ? path.join(downloadDir, `store-${version}.zip`)
        : path.join(downloadDir, `full-${version}.zip`);
    await fs.writeFile(indexHtmlPath, withOcConfig(indexHtml, store));
    await execPromise(`cd ${distBundleDir} && zip -r ../${zipFile} .`);
}
