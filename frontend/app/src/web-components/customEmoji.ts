import { customEmojis } from "@client";
import { sharedStyles } from "./sharedStyles";

const applyStyles = sharedStyles(`
                :host {
                    all: initial;
                    display: inline-block;
                    vertical-align: middle;
                    line-height: 1;
                    height: 1.35rem;
                    padding: 1px;
                }

                :host([big]) {
                    height: 2.2rem;
                    margin-bottom: 8px;
                }

                img {
                    height: 100%;
                    aspect-ratio: 1 / 1;
                    display: block;
                }
            `);

class CustomEmoji extends HTMLElement {
    // Called when the element is connected to the DOM
    connectedCallback() {
        const id = this.dataset.id;
        if (!id) return;

        const emoji = customEmojis.get(id);
        if (emoji === undefined) {
            this.remove();
            return;
        }

        // Clear light DOM content in case someone manually inserted something
        this.innerHTML = "";

        // Attach shadow root if not already attached
        if (!this.shadowRoot) {
            const shadow = this.attachShadow({ mode: "open" });

            const img = document.createElement("img");
            img.src = emoji.url;
            img.alt = emoji.code;
            img.draggable = false;

            applyStyles(shadow);
            shadow.appendChild(img);
        }

        // Prevent editing the element
        this.contentEditable = "false";
    }
}
// Define the custom element tag name
customElements.define("custom-emoji", CustomEmoji);
