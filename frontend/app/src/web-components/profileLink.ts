export type ProfileLinkClickedEvent = {
    userId: string;
    chatButton: boolean;
    inGlobalContext: boolean;
};

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
        const event = new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
            detail: {
                userId: this.userId,
                chatButton: true,
                inGlobalContext: false,
            },
            bubbles: true,
        });
        this.dispatchEvent(event);
    }

    // Called when the element is connected to the DOM
    connectedCallback() {
        const template = document.querySelector("#profile-link-template") as HTMLTemplateElement;
        const instance = document.importNode(template.content, true);
        this.appendChild(instance);
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
