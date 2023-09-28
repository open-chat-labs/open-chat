export type ProfileLinkClickedEvent = {
    userId: string;
    chatButton: boolean;
    inGlobalContext: boolean;
};

class ProfileLink extends HTMLElement {
    private strong?: HTMLElement;

    constructor() {
        super();
    }

    get text(): string {
        return this.getAttribute("text") || "";
    }

    get userId(): string {
        return this.getAttribute("userId") || "";
    }

    set userId(value: string) {
        this.setAttribute("userId", value);
    }

    set text(value: string) {
        this.setAttribute("text", value);
        if (this.strong) {
            this.strong.textContent = `@${value}`;
        }
    }

    // Called when the element is connected to the DOM
    connectedCallback() {
        const template = document.querySelector("#profile-link-template") as HTMLTemplateElement;
        const instance = document.importNode(template.content, true);
        this.appendChild(instance);
        this.strong = this.querySelector("strong") as HTMLSpanElement;
        if (this.strong) {
            this.strong.textContent = `@${this.text}`;
        }

        // Add a click event listener to raise the custom event
        this.addEventListener("click", () => {
            const event = new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId: this.userId,
                    chatButton: true,
                    inGlobalContext: false,
                },
                bubbles: true,
            });
            this.dispatchEvent(event);
        });
    }
}
// Define the custom element tag name
customElements.define("profile-link", ProfileLink);
