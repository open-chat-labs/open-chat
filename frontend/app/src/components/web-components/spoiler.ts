class SpoilerSpan extends HTMLElement {
    private isRevealed: boolean = false;
    private contentWrapper: HTMLSpanElement;

    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.contentWrapper = document.createElement("span");
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    private render() {
        const style = document.createElement("style");
        style.textContent = `
      :host {
        display: inline;
      }

      .spoiler-content {
        filter: blur(5px);
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

      .spoiler-content:hover:not(.revealed) {
        filter: blur(4px);
      }
    `;

        this.contentWrapper.className = "spoiler-content";
        this.contentWrapper.innerHTML = this.innerHTML;

        this.shadowRoot!.appendChild(style);
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

    // Public method to programmatically reveal
    public revealSpoiler() {
        this.reveal();
    }

    // Public method to check if revealed
    public get revealed(): boolean {
        return this.isRevealed;
    }
}

// Register the custom element
customElements.define("spoiler-span", SpoilerSpan);
