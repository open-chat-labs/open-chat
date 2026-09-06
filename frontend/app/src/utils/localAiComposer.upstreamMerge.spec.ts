import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFunction } from "node:vm";
import { compileString } from "sass";
import { compile, preprocess } from "svelte/compiler";
import {
    createSourceFile,
    isFunctionDeclaration,
    ScriptKind,
    ScriptTarget,
    transpileModule,
} from "typescript";
import { describe, expect, it, vi } from "vitest";

function component(tree: string, name = "MessageEntry") {
    const filename = resolve(process.cwd(), `app/src/${tree}/home/${name}.svelte`);
    return { filename, source: readFileSync(filename, "utf8") };
}

async function compileComponent(source: string, filename: string) {
    const buildHelpers = readFileSync(resolve(process.cwd(), "app/rollup.extras.mjs"), "utf8");
    const prepend = buildHelpers.match(/^export const sassModulesAndMixins = "([^"]+)";/mu)?.[1];
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
    return compile(processed.code, { filename, generate: "client" });
}

function declaredFunction(source: string, name: string) {
    const script = source.match(/<script lang="ts">([\s\S]*?)<\/script>/u)?.[1];
    expect(script).toBeDefined();
    const syntax = createSourceFile(
        "component.ts",
        script!,
        ScriptTarget.ES2022,
        true,
        ScriptKind.TS,
    );
    const declaration = syntax.statements.find(
        (statement) => isFunctionDeclaration(statement) && statement.name?.text === name,
    );
    expect(declaration, `missing real component function ${name}`).toBeDefined();
    return transpileModule(declaration!.getText(syntax), {
        compilerOptions: { target: ScriptTarget.ES2022 },
    }).outputText;
}

function sendHarness(overrides: Record<string, unknown> = {}) {
    const { source } = component("components_mobile");
    const context = { chatId: { kind: "direct_chat", userId: "selected-chat" } };
    const approve = vi.fn(async (): Promise<string | undefined> => "approved-account");
    const state = {
        showCommandSelector: false,
        messageIsEmpty: false,
        approvingTransfer: false,
        externalWalletDraft: undefined,
        walletApproval: { approve },
        editor: { getMarkdown: () => "/ai transcribe this", getMentionedUsers: () => [] },
        editingEvent: undefined,
        // Routing itself is covered by localAiCommand.spec; this suite executes the actual
        // merged send functions to prove their ordering around the upstream approval gate.
        routeComposerInput: vi.fn((_: string, options: { editing: boolean }) =>
            options.editing ? "send" : "local-ai",
        ),
        parseLocalAiCommand: vi.fn(() => "transcribe this"),
        localAiComposer: { running: false },
        handleLocalAiCommand: vi.fn(),
        afterSendMessage: vi.fn(),
        toastStore: { showFailureToast: vi.fn() },
        i18nKey: (value: string) => value,
        parseCommands: vi.fn(() => false),
        expandMentions: vi.fn(() => ["edited text", [], false]),
        onSendMessage: vi.fn(),
        localUpdates: { draftMessages: { setAttachment: vi.fn() } },
        messageContext: context,
        ...overrides,
    };
    const execute = compileFunction(
        `${declaredFunction(source, "sendMessage")}
        ${declaredFunction(source, "completeSend")}
        return { sendMessage, isApproving: () => approvingTransfer };`,
        Object.keys(state),
    );
    return {
        state,
        approve,
        ...(execute(...Object.values(state)) as {
            sendMessage: () => void;
            isApproving: () => boolean;
        }),
    };
}

describe("model composer upstream merge contracts", () => {
    it.each(["components", "components_mobile"])(
        "%s keeps a compilable lazy editor and context-aware audio callback",
        async (tree) => {
            const { filename, source } = component(tree);
            await expect(compileComponent(source, filename)).resolves.toHaveProperty("js");
            expect(source).toContain("import type RichTextEditor from");
            expect(source).toContain("loadRichTextEditor().then(");
            expect(source).toContain('console.error("Failed to load the rich text editor", err)');
            expect(source).toContain("{#if EditorComponent}");
            expect(source).toContain("<EditorComponent");
            expect(source.slice(source.indexOf("</script>") + 9)).not.toContain("<RichTextEditor");
            expect(
                /onAudioCaptured=\{\(content\) =>\s*onFileSelected\(content, messageContext\)\}/u.test(
                    source,
                ),
            ).toBe(true);
            expect(source).toContain(
                "onFileSelected: (content: AttachmentContent, context: MessageContext) => void",
            );
            expect(source).toContain('lastMarkdown = "";');
        },
    );

    it("keeps the model manager lazy, reachable, and covered by the load failure fallback", async () => {
        const { filename, source } = component("components_mobile", "SlidingModals");
        await expect(compileComponent(source, filename)).resolves.toHaveProperty("js");
        expect(source).toContain(
            'subscribe("userProfileModels", () => push({ kind: "user_profile_models" }))',
        );
        expect(source).not.toMatch(/import ModelManager from/u);
        expect(source).toMatch(
            /page.kind === "user_profile_models"[\s\S]*?#await import\("\.\/user_profile\/ModelManager.svelte"\)[\s\S]*?<ModelManager\s*\/>\s*\{:catch\}\s*\{@render loadFailed\(\)\}/u,
        );
    });

    it("routes a non-payment /ai send without opening a wallet", () => {
        const harness = sendHarness();
        harness.sendMessage();
        expect(harness.approve).not.toHaveBeenCalled();
        expect(harness.state.handleLocalAiCommand).toHaveBeenCalledExactlyOnceWith(
            "transcribe this",
        );
        expect(harness.state.afterSendMessage).toHaveBeenCalledOnce();
        expect(harness.state.onSendMessage).not.toHaveBeenCalled();
    });

    it("cannot bypass a missing wallet approval component through /ai", () => {
        const harness = sendHarness({ externalWalletDraft: {}, walletApproval: undefined });
        harness.sendMessage();
        expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
        expect(harness.state.onSendMessage).not.toHaveBeenCalled();
        expect(harness.state.afterSendMessage).not.toHaveBeenCalled();
    });

    it("requests approval synchronously, blocks duplicate taps, and dispatches only after approval", async () => {
        let finish!: (value: string | undefined) => void;
        const approved = { kind: "approved-test-content" };
        const approve = vi.fn(
            () => new Promise<string | undefined>((resolve) => (finish = resolve)),
        );
        const draft = { approved: vi.fn(() => approved) };
        const harness = sendHarness({ externalWalletDraft: draft, walletApproval: { approve } });
        harness.sendMessage();
        expect(approve).toHaveBeenCalledOnce();
        expect(harness.isApproving()).toBe(true);
        harness.sendMessage();
        expect(approve).toHaveBeenCalledOnce();
        expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
        finish("approved-account");
        await Promise.resolve();
        await Promise.resolve();
        expect(draft.approved).toHaveBeenCalledExactlyOnceWith("approved-account");
        expect(
            harness.state.localUpdates.draftMessages.setAttachment,
        ).toHaveBeenCalledExactlyOnceWith(harness.state.messageContext, approved);
        expect(harness.state.handleLocalAiCommand).toHaveBeenCalledOnce();
        expect(harness.state.afterSendMessage).toHaveBeenCalledOnce();
        expect(harness.isApproving()).toBe(false);
    });

    it("canceled wallet approval leaves the draft and model request untouched", async () => {
        const draft = { approved: vi.fn() };
        const harness = sendHarness({
            externalWalletDraft: draft,
            walletApproval: { approve: vi.fn(async () => undefined) },
        });
        harness.sendMessage();
        await Promise.resolve();
        await Promise.resolve();
        expect(draft.approved).not.toHaveBeenCalled();
        expect(harness.state.localUpdates.draftMessages.setAttachment).not.toHaveBeenCalled();
        expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
        expect(harness.state.afterSendMessage).not.toHaveBeenCalled();
        expect(harness.isApproving()).toBe(false);
    });

    it("editing an /ai prefix still edits rather than invoking a model", () => {
        const harness = sendHarness({ editingEvent: {} });
        harness.sendMessage();
        expect(harness.state.routeComposerInput).toHaveBeenCalledWith("/ai transcribe this", {
            editing: true,
        });
        expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
        expect(harness.state.onSendMessage).toHaveBeenCalledOnce();
    });

    it("an already running model cannot accept a duplicate prompt or clear the composer", () => {
        const harness = sendHarness({ localAiComposer: { running: true } });
        harness.sendMessage();
        expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
        expect(harness.state.afterSendMessage).not.toHaveBeenCalled();
        expect(harness.state.toastStore.showFailureToast).toHaveBeenCalledOnce();
    });

    it.each(["showCommandSelector", "messageIsEmpty", "approvingTransfer"])(
        "retains the upstream early send guard for %s",
        (flag) => {
            const harness = sendHarness({ [flag]: true });
            harness.sendMessage();
            expect(harness.state.handleLocalAiCommand).not.toHaveBeenCalled();
            expect(harness.state.onSendMessage).not.toHaveBeenCalled();
            expect(harness.approve).not.toHaveBeenCalled();
        },
    );
});
