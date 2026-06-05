/**
 * ESLint rule: no-pagejs-direct
 *
 * Prevents importing page.js directly. All navigation must go through
 * `navigate()` in `app/src/utils/navigation.ts`, which owns push/replace/pop
 * decisions and handles modal cleanup before navigating.
 *
 * Exceptions are explicitly listed in eslint.config.mjs.
 */

/** @type {import("eslint").Rule.RuleModule} */
export default {
    meta: {
        type: "problem",
        docs: {
            description:
                'Disallow direct imports of "page" (page.js router). Use navigate() from @utils/navigation instead.',
            url: "https://github.com/open-chat-labs/open-chat/blob/main/frontend/app/src/utils/navigation.ts",
        },
        messages: {
            noPagejsDirect:
                'Direct import of "page" (page.js) is not allowed. Use navigate() from @utils/navigation instead.',
        },
        schema: [],
    },

    create(context) {
        return {
            ImportDeclaration(node) {
                if (node.source.value === "page") {
                    context.report({ node, messageId: "noPagejsDirect" });
                }
            },
        };
    },
};
