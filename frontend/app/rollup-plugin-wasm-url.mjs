import fs from "node:fs";
import path from "node:path";

const URL_QUERY = "?url";

/**
 * Give Rollup the same `.wasm?url` asset semantics that Vite provides in development.
 * The emitted file is content-hashed by Rollup and the module exports its final URL.
 */
export function wasmUrlAsset() {
    return {
        name: "wasm-url-asset",

        async resolveId(source, importer) {
            if (!source.endsWith(`.wasm${URL_QUERY}`)) return null;

            const resolved = await this.resolve(source.slice(0, -URL_QUERY.length), importer, {
                skipSelf: true,
            });
            if (resolved === null || resolved.external) return null;
            return `${resolved.id}${URL_QUERY}`;
        },

        load(id) {
            if (!id.endsWith(`.wasm${URL_QUERY}`)) return null;

            const wasmPath = id.slice(0, -URL_QUERY.length);
            const referenceId = this.emitFile({
                type: "asset",
                name: path.basename(wasmPath),
                source: fs.readFileSync(wasmPath),
            });
            return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
        },
    };
}
