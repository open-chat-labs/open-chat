// https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative

const regex = new RegExp("^(?:[a-z]+:)?//", "i");

export function isAbsoluteUrl(url: string): boolean {
    return regex.test(url);
}

export const openChatFriendlyUrl =
    process.env.DFX_NETWORK === "ic_test" ? "https://test.oc.app" : "https://oc.app";
export const synonymousUrlRegex = new RegExp(`^(${window.location.origin}|${openChatFriendlyUrl})`);

// detect whether the user is on a canister based url of the form https://6hsbt-vqaaa-aaaaf-aaafq-cai.ic0.app/
export const isCanisterUrl = /https:\/\/.*\.ic0\.app/.test(window.location.origin);

export function addQueryStringParam(name: string, val: string): string {
    const path = window.location.pathname;
    const qs = new URLSearchParams(window.location.search);
    qs.set(name, val);
    return [...qs.keys()].length > 0 ? `${path}?${qs}` : path;
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

const nomenuRoutes = ["miami"];
const scrollingRoutes = [
    "features",
    "roadmap",
    "whitepaper",
    "architecture",
    "blog",
    "miami",
    "guidelines",
    "faq",
];
const landingPageRoutes = ["home", ...scrollingRoutes];

export function isLandingPageRoute(path: string): boolean {
    return landingPageRoutes.find((r) => path.slice(1).toLowerCase().startsWith(r)) !== undefined;
}

export function showMenuForLandingRoute(path: string): boolean {
    return nomenuRoutes.find((r) => path.slice(1).toLowerCase().startsWith(r)) === undefined;
}

export function isScrollingRoute(path: string): boolean {
    return scrollingRoutes.includes(path.slice(1).toLowerCase());
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
            () => resolve(false)
        );
    });
}

export function scrollToSection(section: string): number | undefined {
    const matches = /^(\d{1})(?:-(\d{1}))?(?:-(\d{1}))?$/.exec(section);
    if (!matches) {
        return undefined;
    }

    const [_, one] = matches;

    setTimeout(() => {
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
