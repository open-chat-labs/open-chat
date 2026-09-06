/* eslint-disable no-undef */
import { execFile } from "child_process";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

// Windows includes bsdtar with ZIP support; other build hosts use Info-ZIP.
// Pass paths as arguments instead of shell text so spaces and metacharacters
// in a checkout path cannot break packaging or execute a shell command.
export function bundleArchiveCommand(directory, archive, platform = process.platform) {
    const cwd = path.resolve(directory);
    const target = path.resolve(archive);
    return platform === "win32"
        ? {
              command: path.join(process.env.SystemRoot ?? "C:/Windows", "System32", "tar.exe"),
              // bsdtar otherwise uses the Windows OEM charset, which can replace
              // non-Latin filenames with '?'. Android's Rust ZIP reader requires
              // UTF-8 filename bytes and the ZIP UTF-8 flag for lossless names.
              args: ["-a", "-c", "--options", "zip:hdrcharset=UTF-8", "-f", target, "-C", cwd, "."],
              cwd,
          }
        : { command: "zip", args: ["-q", "-r", target, "."], cwd };
}

export async function createBundleArchive(directory, archive) {
    const { command, args, cwd } = bundleArchiveCommand(directory, archive);
    await execFilePromise(command, args, { cwd });
}

/**
 * We need to create two different bundles here:
 * One for the full version and one for the app store version
 * The difference is just in the OC_APP_STORE env var
 */

export function androidBundlePlugin({ version }) {
    return {
        name: "android-bundle",
        async writeBundle() {
            // Only create OTA zip bundles for web builds. When building the APK
            // directly (OC_APP_TYPE=android) the zips are not needed and would
            // just bloat the APK.
            if (process.env.OC_APP_TYPE === "android") {
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
    const ota = store ? "patch" : "major";
    const zipFile = store
        ? path.join(downloadDir, `store-${version}.zip`)
        : path.join(downloadDir, `full-${version}.zip`);
    const injection = `<script>window.OC_CONFIG={OC_MOBILE_LAYOUT:"v2", OC_APP_STORE: "${store}", OC_OTA_UPDATES: "${ota}"}</script>`;
    const updatedIndexHtml = indexHtml.replace("<head>", `<head>${injection}`);
    await fs.writeFile(indexHtmlPath, updatedIndexHtml);
    await createBundleArchive(distBundleDir, zipFile);
}
