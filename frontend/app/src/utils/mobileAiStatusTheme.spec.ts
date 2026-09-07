import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileString } from "sass";
import { flushSync, mount, unmount } from "svelte";
import { compile, preprocess } from "svelte/compiler";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Spinner from "../../../component-lib/src/components/Spinner.svelte";
import { applyTheme } from "../../../component-lib/src/theme";

const surfaces = [
    ["MessageEntry", ".local-ai-status"],
    ["ChatMessage", ".local-ai-message-status"],
] as const;

function component(name: string) {
    const filename = resolve(process.cwd(), `app/src/components_mobile/home/${name}.svelte`);
    return { filename, source: readFileSync(filename, "utf8") };
}

const styles = new Map<string, Promise<string>>();
function emittedStyles(name: string): Promise<string> {
    let result = styles.get(name);
    if (result === undefined) {
        result = (async () => {
            const { source, filename } = component(name);
            const helpers = readFileSync(resolve(process.cwd(), "app/rollup.extras.mjs"), "utf8");
            const prepend = helpers.match(/^export const sassModulesAndMixins = "([^"]+)";/mu)?.[1];
            expect(prepend).toBeDefined();
            const processed = await preprocess(source, {
                style: ({ content, attributes }) =>
                    attributes.lang === "scss"
                        ? {
                              code: compileString(`${prepend}\n${content}`, {
                                  loadPaths: [resolve(process.cwd(), "app/src/styles")],
                              }).css,
                          }
                        : undefined,
            });
            const css = compile(processed.code, { filename, generate: "client" }).css?.code;
            expect(css).toBeDefined();
            return css!;
        })();
        styles.set(name, result);
    }
    return result;
}

function referencedVariables(value: string): string[] {
    return [...value.matchAll(/var\((--[\w-]+)/gu)].map((match) => match[1]);
}

function expectDefinedVariables(value: string) {
    const references = referencedVariables(value);
    expect(references.length).toBeGreaterThan(0);
    const missing = references.filter(
        (name) => document.documentElement.style.getPropertyValue(name).trim().length === 0,
    );
    expect(missing, `theme variables missing from emitted style: ${value}`).toEqual([]);
}

let rootStyle: string | null;
beforeEach(() => {
    rootStyle = document.documentElement.getAttribute("style");
    document.documentElement.removeAttribute("style");
});
afterEach(() => {
    if (rootStyle === null) document.documentElement.removeAttribute("style");
    else document.documentElement.setAttribute("style", rootStyle);
});

describe.each(["neon", "neon-light"])("mobile AI status theme: %s", (theme) => {
    it.each(surfaces)(
        "%s emits status CSS using defined theme variables",
        async (name, selector) => {
            applyTheme(theme);
            const css = await emittedStyles(name);
            const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].filter((match) =>
                match[1].includes(selector),
            );
            expect(rules.length).toBeGreaterThan(0);
            expectDefinedVariables(rules.map((match) => match[2]).join("\n"));
        },
    );

    it.each([
        ["ChatMessage", 2],
        ["AutoProposeChip", 1],
    ] as const)(
        "%s renders its actual spinner prop values with defined stroke colors",
        async (name, count) => {
            applyTheme(theme);
            // Read the real caller's props, then mount the real shared Spinner. This is deliberately
            // a focused rendering surface, not a claim to mount the complete chat/account lifecycle.
            const tags = [...component(name).source.matchAll(/<Spinner\b[^>]*\/>/gu)];
            expect(tags).toHaveLength(count);
            for (const [tag] of tags) {
                const props: Record<string, string> = {};
                for (const field of ["foregroundColour", "backgroundColour"]) {
                    const value = tag.match(new RegExp(`${field}=\\{?"([^"]+)"\\}?`, "u"))?.[1];
                    expect(value, `${name} must retain an explicit ${field}`).toBeDefined();
                    props[field] = value!;
                }
                const target = document.createElement("div");
                document.body.append(target);
                const spinner = mount(Spinner, { target, props });
                try {
                    flushSync();
                    const strokes = [...target.querySelectorAll("svg [style]")];
                    expect(strokes).toHaveLength(2);
                    strokes.forEach((stroke) =>
                        expectDefinedVariables(stroke.getAttribute("style")!),
                    );
                } finally {
                    await unmount(spinner);
                    target.remove();
                }
            }
        },
    );
});
