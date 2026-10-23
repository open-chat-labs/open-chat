export type ProfileLinkClickedEvent = {
    userId: string;
    chatButton: boolean;
    inGlobalContext: boolean;
};

/** The event that opens `userId`'s profile card, from a name clicked in a chat. */
export function profileClickedEvent(userId: string): CustomEvent<ProfileLinkClickedEvent> {
    return new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
        detail: { userId, chatButton: true, inGlobalContext: false },
        bubbles: true,
    });
}

class ProfileLink extends HTMLElement {
    constructor() {
        super();
        this.handleClick = this.handleClick.bind(this);
    }

    get text(): string {
        return this.getAttribute("text") || "";
    }

    set text(value: string) {
        this.setAttribute("text", value);
        this.textContent = `@${value}`;
    }

    get userId(): string {
        return this.getAttribute("user-id") || "";
    }

    set userId(value: string) {
        this.setAttribute("user-id", value);
    }

    get suppressLinks(): boolean {
        return this.getAttribute("suppress-links") === "true";
    }

    set suppressLinks(value: boolean) {
        this.setAttribute("suppress-links", value.toString());
    }

    handleClick() {
        this.dispatchEvent(profileClickedEvent(this.userId));
    }

    // Called when the element is connected to the DOM
    connectedCallback() {
        // The template in index.html is empty; only its inline style is used.
        const template = document.querySelector("#profile-link-template") as HTMLTemplateElement;
        this.setAttribute("style", template.style.cssText);
        this.textContent = `@${this.text}`;

        // Add a click event listener to raise the custom event
        if (!this.suppressLinks) {
            this.addEventListener("click", this.handleClick);
        }
    }

    disconnectedCallback() {
        this.removeEventListener("click", this.handleClick);
    }
}
// Define the custom element tag name
customElements.define("profile-link", ProfileLink);
