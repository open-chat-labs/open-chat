// https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative

const regex = new RegExp("^(?:[a-z]+:)?//", "i");

export function isAbsoluteUrl(url: string): boolean {
    return regex.test(url);
}
