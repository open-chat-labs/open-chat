/**
 * ESLint rule: no-restricted-dynamic-imports
 *
 * no-restricted-imports only sees static imports and re-exports. This reports a dynamic
 * `import("...")` whose module name matches one of the configured regexes, so the app's
 * layering rules also hold for lazily loaded modules.
 *
 * Options: { patterns: [{ regex: string, message: string }] }, configured in eslint.config.mjs.
 */

/** @type {import("eslint").Rule.RuleModule} */
export default {
    meta: {
        type: "problem",
        docs: {
            description: "Disallow dynamic imports of modules matching configured patterns.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    patterns: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                regex: { type: "string" },
                                message: { type: "string" },
                            },
                            required: ["regex", "message"],
                            additionalProperties: false,
                        },
                    },
                },
                additionalProperties: false,
            },
        ],
    },

    create(context) {
        const patterns = (context.options[0]?.patterns ?? []).map((p) => ({
            regex: new RegExp(p.regex),
            message: p.message,
        }));

        function moduleName(source) {
            if (source.type === "Literal" && typeof source.value === "string") {
                return source.value;
            }
            if (source.type === "TemplateLiteral" && source.expressions.length === 0) {
                return source.quasis[0].value.cooked;
            }
            return undefined;
        }

        return {
            ImportExpression(node) {
                const name = moduleName(node.source);
                if (name === undefined) return;
                const match = patterns.find((p) => p.regex.test(name));
                if (match) {
                    context.report({
                        node,
                        message: `'${name}' import is restricted. ${match.message}`,
                    });
                }
            },
        };
    },
};
