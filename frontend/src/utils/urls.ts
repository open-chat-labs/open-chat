// https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative

const regex = new RegExp("^(?:[a-z]+:)?//", "i");

export function isAbsoluteUrl(url: string): boolean {
    return regex.test(url);
}

export const openChatFriendlyUrl =
    process.env.DFX_NETWORK === "ic_test" ? "https://test.oc.app" : "https://oc.app";
export const synonymousUrlRegex = new RegExp(`^(${window.location.origin}|${openChatFriendlyUrl})`);
