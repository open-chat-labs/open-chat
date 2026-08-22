import { sharedStyles } from "./sharedStyles";

const applyStyles = sharedStyles(`
      :host {
        display: inline;
      }

      .spoiler-content {
        filter: blur(6px);
        cursor: pointer;
        user-select: none;
        transition: filter 0.3s ease;
        display: inline;
      }

      .spoiler-content.revealed {
        filter: none;
        cursor: default;
        user-select: text;
      }
    `);

class SpoilerSpan extends HTMLElement {
    private isRevealed: boolean = false;
    private rendered: boolean = false;
    private contentWrapper: HTMLSpanElement;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.contentWrapper = document.createElement("span");
    }

    connectedCallback() {
        // Virtual-list recycling re-connects the same element; render once.
        if (this.rendered) return;
        this.rendered = true;
        this.render();
        this.setupEventListeners();
    }

    private render() {
        this.contentWrapper.className = "spoiler-content";
        this.contentWrapper.innerHTML = this.innerHTML;

        applyStyles(this.shadowRoot!);
        this.shadowRoot!.appendChild(this.contentWrapper);
    }

    private setupEventListeners() {
        this.contentWrapper.addEventListener("click", () => {
            if (!this.isRevealed) {
                this.reveal();
            }
        });
    }

    private reveal() {
        this.isRevealed = true;
        this.contentWrapper.classList.add("revealed");
        this.dispatchEvent(
            new CustomEvent("spoiler-revealed", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    public revealSpoiler() {
        this.reveal();
    }

    public get revealed(): boolean {
        return this.isRevealed;
    }
}

customElements.define("spoiler-span", SpoilerSpan);
