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

export function androidBundlePlugin({ version }) {
    return {
        name: "android-bundle",
        async writeBundle() {
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

                // Inject Android Config
                const indexHtmlPath = path.join(distBundleDir, "index.html");
                let indexHtml = await fs.readFile(indexHtmlPath, "utf-8");

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
    const injection = `<script>window.OC_CONFIG={OC_APP_TYPE:"android",OC_MOBILE_LAYOUT:"v2", OC_APP_STORE: "${store}"}</script>`;
    const updatedIndexHtml = indexHtml.replace("<head>", `<head>${injection}`);
    await fs.writeFile(indexHtmlPath, updatedIndexHtml);
    await execPromise(`cd ${distBundleDir} && zip -r ../${zipFile} .`);
}
