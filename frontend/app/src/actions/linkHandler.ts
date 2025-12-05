import { openUrl } from "tauri-plugin-oc-api";

export function linkHandler(node: HTMLElement) {
    function handleClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const link = target.closest("a");

        if (!link) return;

        const href = link.getAttribute("href");

        // Only intercept external links when in Tauri
        if (
            window.__TAURI__ &&
            href &&
            (href.startsWith("http://") || href.startsWith("https://"))
        ) {
            event.preventDefault();
            event.stopPropagation();

            openUrl({ url: href }).catch((err) => {
                console.error("Failed to open URL:", href, err);
                window.open(href, "_blank");
            });
        }
    }

    node.addEventListener("click", handleClick);

    return {
        destroy() {
            node.removeEventListener("click", handleClick);
        },
    };
}
