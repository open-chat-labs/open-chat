import type RichTextEditor from "./RichTextEditor.svelte";

// The rich text editor pulls in tiptap + ProseMirror + lowlight (~445 KB raw /
// ~140 KB gz), roughly a quarter of the critical-path JS. Loading it through
// this module (rather than a static import) makes it its own chunk, off the
// critical path. It is NOT deferred to first use: App warms it at idle once
// the user is logged in, and MessageEntry requests it on mount, so in the
// normal flow it is a module-cache hit by the time a chat is opened.
//
// Loading on composer focus was deliberately rejected: mobile browsers only
// raise the soft keyboard for a focus() that is synchronous within the user
// gesture, so tap → await import() → focus() would leave the keyboard closed.

type EditorComponent = typeof RichTextEditor;

let loaded: EditorComponent | undefined;
let loading: Promise<EditorComponent> | undefined;

export function richTextEditorIfLoaded(): EditorComponent | undefined {
    return loaded;
}

export function loadRichTextEditor(): Promise<EditorComponent> {
    loading ??= import("./RichTextEditor.svelte").then(
        (m) => (loaded = m.default),
        (err) => {
            // allow a later mount to retry (e.g. transient network failure)
            loading = undefined;
            throw err;
        },
    );
    return loading;
}

export function warmRichTextEditor(): void {
    const run = () => {
        loadRichTextEditor().catch(() => {
            // a failed warm-up is not an error; the mount path retries and reports
        });
    };
    if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 5000 });
    } else {
        setTimeout(run, 1000);
    }
}
