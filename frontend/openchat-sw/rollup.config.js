/* eslint-disable no-undef */
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import dev from "rollup-plugin-dev";
import html from "@rollup/plugin-html";
import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";

const production = !process.env.ROLLUP_WATCH;

function serve() {
    return dev({
        dirs: ["./build"],
        spa: "./index.html",
        port: 8081,
    });
}

function cleanExcept(files) {
    if (fs.existsSync("_temp")) {
        rimraf.sync(path.join(__dirname, "_temp"));
    }
    fs.mkdirSync("_temp");

    files.forEach((file) => {
        if (fs.existsSync(path.join(__dirname, "build", file))) {
            fs.copyFileSync(
                path.join(__dirname, "build", file),
                path.join(__dirname, "_temp", file)
            );
        }
    });

    rimraf.sync(path.join(__dirname, "build"));
    fs.mkdirSync("build");

    files.forEach((file) => {
        if (fs.existsSync(path.join(__dirname, "_temp", file))) {
            fs.copyFileSync(
                path.join(__dirname, "_temp", file),
                path.join(__dirname, "build", file)
            );
        }
    });

    rimraf.sync(path.join(__dirname, "_temp"));
}

function clean() {
    return {
        name: "clean-build",
        renderStart() {
            console.log("cleaning up the build directory");
            cleanExcept(["sw.js", "sw.js.map"]);
        },
    };
}

console.log("Production: ", production);
console.log("INTERNET_IDENTITY_URL", process.env.INTERNET_IDENTITY_URL);
console.log("NFID_URL", process.env.NFID_URL);

export default {
    input: "./src/main.ts",
    output: {
        sourcemap: true,
        format: "es",
        name: "app",
        dir: "build",
        entryFileNames: "[name]-[hash].js",
    },
    plugins: [
        clean(),
        typescript({
            sourceMap: !production,
            inlineSources: !production,
        }),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        !production && livereload("public"),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser(),

        // nodePolyfills(/* options */),

        html({
            template: ({ files }) => {
                const jsEntryFile = files.js.find((f) => f.isEntry).fileName;

                return `
                    <!DOCTYPE html>
                    <html lang="en">
                        <head>
                            <title>OpenChat: Decentralized chat on the Internet Computer</title>
                            <meta charset="utf-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                            <meta name="description" content="OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain." />
                            <script type="module" defer src="/${jsEntryFile}"></script>
                            <style>
                                body {
                                    padding: 0;
                                    margin: 0;
                                    font-family: Helvetica;
                                }
                                .main {
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    color: rgba(255, 255, 255, 0.8);
                                    font-weight: 900;
                                    background-color: #121212;
                                    overflow-y: auto;
                                    overflow-x: hidden;
                                    height: 100vh;
                                    min-height: 100%;
                                    padding: 20px;
                                    text-align: center;
                                }
                            </style>
                        </head>
                        <body>
                            <main class="main">
                                <h1>Please wait a moment while we load OpenChat ...</h1>
                            </main> 
                        </body>
                    </html>
                    `;
            },
        }),
    ],
    watch: {
        clearScreen: false,
    },
};
