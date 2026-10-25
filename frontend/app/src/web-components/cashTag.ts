import type { PriceSubject } from "@client";

/** What a clicked cashtag stands for: a token OpenChat lists, or a coin it doesn't. */
export type CashtagClickedEvent = PriceSubject;

/** The event that opens a token's or coin's price card, from a cashtag clicked in a message. */
export function cashtagClickedEvent(subject: PriceSubject): CustomEvent<CashtagClickedEvent> {
    return new CustomEvent<CashtagClickedEvent>("cashtag-clicked", {
        detail: subject,
        bubbles: true,
    });
}

// A chip with the token's symbol, which is the element's text, and then its price, which is its
// ::after and so not part of the text: copying a message gives back "$CHAT" as it was sent. In the
// page's own styles rather than a shadow root's, so that ::after is plain CSS that every browser
// supports. Coloured from the text it's in, so it suits every theme
const style = document.createElement("style");
style.textContent = `
    cash-tag {
        display: inline-block;
        padding: 0 0.3em;
        border-radius: 0.3em;
        /* for browsers without color-mix */
        background: rgba(128, 128, 128, 0.15);
        background: color-mix(in srgb, currentColor 12%, transparent);
        font-weight: 700;
        white-space: nowrap;
    }

    cash-tag[data-price]::after {
        content: " " attr(data-price);
        font-weight: 400;
        opacity: 0.8;
    }

    cash-tag[role="button"] {
        cursor: pointer;
    }
`;
document.head.appendChild(style);

class CashTag extends HTMLElement {
    constructor() {
        super();
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    get subject(): PriceSubject {
        const coin = this.dataset.coin;
        return coin !== undefined
            ? { kind: "coin", id: coin }
            : { kind: "token", ledger: this.dataset.ledger ?? "" };
    }

    get suppressLinks(): boolean {
        return this.getAttribute("suppress-links") === "true";
    }

    handleClick() {
        this.dispatchEvent(cashtagClickedEvent(this.subject));
    }

    handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.handleClick();
        }
    }

    connectedCallback() {
        // the credit its price needs, eg. "Price data by CoinGecko", as a tooltip: the card it opens
        // shows the credit too
        if (this.dataset.credit !== undefined) {
            this.title = this.dataset.credit;
        }
        if (!this.suppressLinks) {
            this.setAttribute("role", "button");
            this.tabIndex = 0;
            this.addEventListener("click", this.handleClick);
            this.addEventListener("keydown", this.handleKeyDown);
        }
    }

    disconnectedCallback() {
        this.removeEventListener("click", this.handleClick);
        this.removeEventListener("keydown", this.handleKeyDown);
    }
}

customElements.define("cash-tag", CashTag);
