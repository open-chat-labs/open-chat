// https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative

const regex = new RegExp("^(?:[a-z]+:)?//", "i");

export function isAbsoluteUrl(url: string): boolean {
    return regex.test(url);
}

export const openChatFriendlyUrl =
    process.env.DFX_NETWORK === "ic_test" ? "https://test.oc.app" : "https://oc.app";
export const synonymousUrlRegex = new RegExp(`^(${window.location.origin}|${openChatFriendlyUrl})`);

function replaceQueryString(qs: URLSearchParams): string {
    const qsStr = [...qs.keys()].length > 0 ? `?${qs}` : "";
    const hash = window.location.hash.replace("#", "");
    const match = hash.match(/.*(\?.*)/);
    if (match) {
        return hash.replace(match[1], qsStr);
    }
    return hash.startsWith("/") ? `${hash}${qsStr}` : `/${hash}${qsStr}`;
}

export function addQueryStringParam(qs: URLSearchParams, name: string, val: string): string {
    qs.set(name, val);
    return replaceQueryString(qs);
}

export function removeQueryStringParam(qs: URLSearchParams, name: string): string {
    qs.delete(name);
    return replaceQueryString(qs);
}
