/**
 * ESLint rule: structure-boundaries
 *
 * Enforces the src/ layout contract of frontend/app:
 *
 *   1. The desktop and mobile trees never import each other. Anything both
 *      need lives in src/ui (and is flagged in src/ui/STRAGGLERS.md).
 *   2. src/ui is platform-agnostic: it must not import from desktop/, mobile/,
 *      or anything else platform-bound.
 *   3. Features are private to each other. `features/x` may not import from
 *      `features/y`, with two deliberate exceptions:
 *        - `features/y/exports/**` — a feature's published surface
 *          (e.g. bots/exports/BotBadge.svelte);
 *        - `features/chats/core/**` — the kind-agnostic message-rendering
 *          engine, importable by any feature.
 *
 * shared/ and shell/ within a platform tree are not restricted by this rule.
 */

const PLATFORMS = new Set(["desktop", "mobile"]);

// path relative to app/src -> location descriptor
function classify(p) {
    const parts = p.split("/");
    if (PLATFORMS.has(parts[0])) {
        const loc = { plat: parts[0], kind: parts[1] };
        if (parts[1] === "features") {
            loc.feature = parts[2];
            loc.rest = parts.slice(3).join("/");
        }
        return loc;
    }
    if (parts[0] === "ui") return { kind: "ui" };
    return { kind: "other" };
}

function srcRelative(absPath) {
    const marker = absPath.lastIndexOf("app/src/");
    return marker === -1 ? null : absPath.slice(marker + "app/src/".length);
}

export default {
    meta: {
        type: "problem",
        docs: {
            description:
                "Enforce platform (desktop/mobile/ui) and feature-privacy import boundaries in app/src.",
        },
        messages: {
            crossPlatform:
                "{{importerPlat}} code must not import from the {{targetPlat}} tree. Shared code belongs in src/ui (and gets an entry in src/ui/STRAGGLERS.md).",
            uiToPlatform:
                "src/ui is platform-agnostic and must not import from the {{targetPlat}} tree.",
            featurePrivacy:
                'Feature "{{importerFeature}}" must not reach into feature "{{targetFeature}}". Import its exports/ surface, use features/chats/core, or move the component to shared/.',
        },
        schema: [],
    },

    create(context) {
        const filename = context.filename ?? context.getFilename();
        const importerRel = srcRelative(filename.replace(/\\/g, "/"));
        if (!importerRel) return {};
        const importer = classify(importerRel);

        function resolveTargetRel(spec) {
            if (spec.startsWith("@src/")) return spec.slice(5);
            if (!spec.startsWith(".")) return null;
            const importerDir = importerRel.split("/").slice(0, -1);
            const parts = spec.split("/");
            const stack = [...importerDir];
            for (const part of parts) {
                if (part === "." || part === "") continue;
                else if (part === "..") stack.pop();
                else stack.push(part);
            }
            return stack.join("/");
        }

        function check(node, spec) {
            if (typeof spec !== "string") return;
            const targetRel = resolveTargetRel(spec);
            if (!targetRel) return;
            const target = classify(targetRel);

            if (importer.plat && target.plat && importer.plat !== target.plat) {
                context.report({
                    node,
                    messageId: "crossPlatform",
                    data: { importerPlat: importer.plat, targetPlat: target.plat },
                });
                return;
            }
            if (importer.kind === "ui" && target.plat) {
                context.report({ node, messageId: "uiToPlatform", data: { targetPlat: target.plat } });
                return;
            }
            if (
                importer.kind === "features" &&
                target.kind === "features" &&
                importer.feature !== target.feature
            ) {
                const viaExports = (target.rest ?? "").split("/").includes("exports");
                const viaChatsCore = target.feature === "chats" && (target.rest ?? "").startsWith("core/");
                if (!viaExports && !viaChatsCore) {
                    context.report({
                        node,
                        messageId: "featurePrivacy",
                        data: { importerFeature: importer.feature, targetFeature: target.feature },
                    });
                }
            }
        }

        return {
            ImportDeclaration(node) {
                check(node, node.source.value);
            },
            ExportNamedDeclaration(node) {
                if (node.source) check(node, node.source.value);
            },
            ExportAllDeclaration(node) {
                check(node, node.source.value);
            },
            ImportExpression(node) {
                if (node.source.type === "Literal") check(node, node.source.value);
            },
        };
    },
};
