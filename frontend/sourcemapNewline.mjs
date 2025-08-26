export function sourcemapNewline() {
    return {
        name: "sourcemap-newline",
        generateBundle(_, bundle) {
            for (const fileName in bundle) {
                const chunk = bundle[fileName];
                if (chunk.type === "chunk") {
                    const sourceMappingRegex = /(\/\/[@#] sourceMappingURL=.+)(\r?\n)?$/;
                    const match = chunk.code.match(sourceMappingRegex);

                    if (match) {
                        chunk.code = chunk.code.replace(sourceMappingRegex, "\n$1\n");
                    }
                }
            }
        },
    };
}
