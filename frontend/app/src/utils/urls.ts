// https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative

import { OpenChat, routeStore, type RouteParams, type RouteType } from "@client";
import { openUrl } from "tauri-plugin-oc-api";

const regex = new RegExp("^(?:[a-z]+:)?//", "i");

export function isAbsoluteUrl(url: string): boolean {
    return regex.test(url);
}

export const openChatFriendlyUrl =
    import.meta.env.OC_DFX_NETWORK === "ic_test" ? "https://test.oc.app" : "https://oc.app";
export const synonymousUrlRegex = new RegExp(
    `^(${import.meta.env.OC_BASE_ORIGIN!}|${openChatFriendlyUrl})`,
);

export function addQueryStringParam(name: string, val: string): string {
    const path = window.location.pathname;
    const qs = new URLSearchParams(window.location.search);
    qs.set(name, val);
    return [...qs.keys()].length > 0 ? `${path}?${qs}` : path;
}

export function stripThreadFromUrl(path: string) {
    if (
        (routeStore.value.kind === "global_chat_selected_route" ||
            routeStore.value.kind === "selected_channel_route") &&
        routeStore.value.threadMessageIndex !== undefined
    ) {
        return removeThreadMessageIndex(routeStore.value.threadMessageIndex, path);
    }
    return path;
}

export function removeThreadMessageIndex(threadMessageIndex: number, path: string): string {
    const re = new RegExp(`(\\/${threadMessageIndex})(\\?.*)?$`);
    return path.replace(re, "");
}

export function removeQueryStringParam(name: string): string {
    const path = window.location.pathname;
    const qs = new URLSearchParams(window.location.search);
    qs.delete(name);
    return [...qs.keys()].length > 0 ? `${path}?${qs}` : path;
}

const nomenuRoutes: RouteType[] = [];
const scrollingRoutes: RouteType[] = [
    "features_route",
    "roadmap_route",
    "whitepaper_route",
    "architecture_route",
    "blog_route",
    "guidelines_route",
    "terms_route",
    "faq_route",
    "diamond_route",
];
const landingPageRoutes: RouteType[] = ["home_landing_route", ...scrollingRoutes];

export function isLandingPageRoute(route: RouteParams): boolean {
    return landingPageRoutes.includes(route.kind);
}

export function showMenuForLandingRoute(route: RouteParams): boolean {
    return !nomenuRoutes.includes(route.kind);
}

export function isScrollingRoute(route: RouteParams): boolean {
    return scrollingRoutes.includes(route.kind);
}

// it is possible that old style landing page links will still get through the cloudfront redirect, so we will need to
// address them in-app as well just in case
export function redirectLandingPageLinksIfNecessary(): void {
    const path = getRedirectPath(window.location.pathname, window.location.hash);
    if (path !== window.location.pathname) {
        window.location.href = path;
    }
}

function getRedirectPath(path: string, hash: string): string {
    const match = path.match(/^\/(home|whitepaper|features|roadmap|architecture)/i);
    if (match) {
        return `/${match[1]}${hash !== "" ? `?section=${hash.slice(1)}` : ""}`;
    }
    return path;
}

export function copyToClipboard(txt: string): Promise<boolean> {
    return new Promise((resolve) => {
        navigator.clipboard.writeText(txt).then(
            () => resolve(true),
            () => resolve(false),
        );
    });
}

export function scrollToSection(section: string): number | undefined {
    const matches = /^(\d{1})(?:-(\d{1}))?(?:-(\d{1}))?$/.exec(section);
    if (!matches) {
        return undefined;
    }

    const [_, one] = matches;

    window.setTimeout(() => {
        const target = document.getElementById(section);
        if (!target) {
            console.log("target not found");
            return;
        }

        const rect = target.getBoundingClientRect();
        const top = rect.top + window.scrollY - 80;
        console.log("Scrolling to ", window.scrollY, rect);
        window.scrollTo({
            top,
        });
        target.classList.add("highlight");
        window.setTimeout(() => {
            target.classList.remove("highlight");
        }, 1000);
    }, 200); // this 200 is the duration of the collapsible card transition :puke:

    return Number(one);
}

// oc.app paths that are public marketing / landing pages rather than in-app
// content. The markdown renderer rewrites oc.app links to relative urls (see
// utils/markdown.ts) so that links to chats/groups/users deep-link into the
// app. In the native app these landing-page links should instead open in an
// external browser tab. Keep in sync with the landing routes registered in
// components/Router.svelte.
const landingPagePaths = new Set([
    "home",
    "features",
    "roadmap",
    "blog",
    "whitepaper",
    "guidelines",
    "terms",
    "faq",
    "diamond",
    "architecture",
]);

export function isLandingPagePath(pathname: string): boolean {
    const first = pathname.split("/").filter((s) => s.length > 0)[0];
    return first !== undefined && landingPagePaths.has(first.toLowerCase());
}

const SUPPORTED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSupportedExternalUrl(url: URL): boolean {
    return SUPPORTED_EXTERNAL_PROTOCOLS.has(url.protocol);
}

export async function openExternalUrl(client: OpenChat, url: string): Promise<void> {
    const parsed = new URL(url);
    if (!isSupportedExternalUrl(parsed)) {
        throw new Error(`Unsupported external URL: ${parsed.protocol}`);
    }

    const href = parsed.toString();

    if (client.isNativeApp()) {
        await openUrl({ url: href });
        return;
    }

    if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
        window.location.href = href;
        return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
}

export function handleLinkClick(
    client: OpenChat,
    onInternal: (url: string) => void,
): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (e.defaultPrevented) return;

        const target =
            e.target instanceof Element
                ? e.target
                : e.target instanceof Node
                  ? e.target.parentElement
                  : null;
        const anchor = target?.closest("a");
        if (!anchor || !anchor.href) return;
        if (anchor.getAttribute("role") === "button") return;

        // Don't navigate when clicking links inside a contenteditable editor
        if (anchor.closest("[contenteditable]")) {
            e.preventDefault();
            return;
        }

        let url: URL;
        try {
            url = new URL(anchor.href);
        } catch {
            return;
        }

        if (url.origin !== window.location.origin) {
            if (anchor.hasAttribute("download") || !isSupportedExternalUrl(url)) return;

            if (client.isNativeApp()) {
                e.preventDefault();
                void openExternalUrl(client, url.toString()).catch((error) => {
                    console.error("Failed to open external link", error);
                });
                return;
            }

            // On the web, let the browser handle the anchor natively. A
            // programmatic window.open from an iOS home-screen app always
            // spawns an in-app browser sheet — even for a universal link that
            // immediately hands off to another app, which leaves a blank
            // sheet behind. A real anchor click opens the target app
            // directly. Just make sure the link leaves the app in a new
            // browsing context rather than navigating the standalone webview.
            if (url.protocol === "http:" || url.protocol === "https:") {
                anchor.target = "_blank";
                anchor.rel = "noopener noreferrer";
            }
            return;
        }

        if (anchor.target || anchor.hasAttribute("download")) return;

        // oc.app links to marketing / landing pages were rewritten to relative
        // urls by the markdown renderer. In the native app open these in an
        // external browser tab rather than navigating inside the app.
        if (client.isNativeApp() && isLandingPagePath(url.pathname)) {
            e.preventDefault();
            void openExternalUrl(
                client,
                openChatFriendlyUrl + url.pathname + url.search + url.hash,
            ).catch((error) => {
                console.error("Failed to open external link", error);
            });
            return;
        }

        e.preventDefault();
        onInternal(url.pathname + url.search + url.hash);
    };
}
