import {
    loadRichTextEditor,
    richTextEditorIfLoaded,
    type EditorComponent,
} from "./richTextEditorLoader";

/**
 * The rich-text editor's component for a composer, once its chunk is here: at once when it's been
 * warmed (the normal case), else requested as the composer is made (richTextEditorLoader). Until
 * then `component` is undefined and the composer shows its plain text box.
 */
export class RichTextEditorLoad {
    #component = $state<EditorComponent | undefined>(richTextEditorIfLoaded());

    constructor() {
        if (this.#component === undefined) void this.#load();
    }

    get component(): EditorComponent | undefined {
        return this.#component;
    }

    async #load(): Promise<void> {
        try {
            this.#component = await loadRichTextEditor();
        } catch (err) {
            // the plain text box stays; a later composer tries again
            console.error("Failed to load the rich text editor", err);
        }
    }
}
