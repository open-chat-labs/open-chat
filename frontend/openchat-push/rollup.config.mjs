import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import del from "rollup-plugin-delete";

// Put external dependencies into their own bundle so that they get cached separately
function manualChunks(id) {
    if (id.includes("node_modules")) {
        return "push-vendor";
    }
}

export default {
    input: `./src/push_sw.ts`,
    output: {
        dir: "./lib",
        sourcemap: true,
        compact: true,
        manualChunks
    },
    plugins: [
        del({ targets: "lib/*" }),
        typescript({
            sourceMap: true
        }),
        commonjs(),
        inject({
            process: "process/browser",
        }),
        json(),
        resolve({
            browser: true,
            preferBuiltins: false,
            dedupe: ["@dfinity/candid"],
        }),
        terser()
    ]
};
