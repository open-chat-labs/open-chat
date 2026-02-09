/* eslint-disable no-undef */
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export function androidBundlePlugin({ version }) {
    return {
        name: "android-bundle",
        async writeBundle() {
            const buildDir = "build";
            const bundleDir = "dist_bundle";
            const downloadDir = path.join(buildDir, "downloads");
            const zipFile = path.join(downloadDir, `bundle-${version}.zip`);

            // eslint-disable-next-line no-undef
            console.log(`Creating Android bundle: ${zipFile}`);

            try {
                // Ensure clean state
                await fs.remove(bundleDir);
                await fs.ensureDir(bundleDir);
                await fs.ensureDir(downloadDir);

                // Copy public and build contents to bundle directory
                // We use shell cp for simplicity and speed similar to original script,
                // but fs-extra copy is safer cross-platform.
                // Original script: cp -r public/. dist_bundle/ && cp -r build/. dist_bundle/
                // Note: build/ contains downloads/, we must exclude it to avoid recursion if we use fs.copy

                await fs.copy("public", bundleDir);

                // Copy build/ but filter out downloads/
                await fs.copy(buildDir, bundleDir, {
                    filter: (src) => !src.includes(path.join(buildDir, "downloads")),
                });

                // Inject Android Config
                const indexHtmlPath = path.join(bundleDir, "index.html");
                let indexHtml = await fs.readFile(indexHtmlPath, "utf-8");

                const injection = `<script>window.OC_CONFIG={OC_APP_TYPE:"android",OC_MOBILE_LAYOUT:"v2"}</script>`;
                indexHtml = indexHtml.replace("<head>", `<head>${injection}`);

                await fs.writeFile(indexHtmlPath, indexHtml);

                // Zip it
                // Using zip command line for consistency with previous behavior,
                // assuming 'zip' is available (it was used in the shell script).
                await execPromise(`cd ${bundleDir} && zip -r ../${zipFile} .`);

                console.log("Android bundle created successfully.");
            } catch (err) {
                console.error("Failed to create Android bundle:", err);
                throw err;
            } finally {
                await fs.remove(bundleDir);
            }
        },
    };
}
