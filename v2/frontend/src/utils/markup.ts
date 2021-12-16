/* eslint-disable no-useless-escape */

// Blacklisted completely
// " < \s
//
// Blacklisted from end
// . , ( ) [ ] { } ! @ + : %
export function wrapURLsInAnchorTags(text: string, new_window: boolean): string {
    const url_pattern = /(ftp|http|https):\/\/[^\"<\s]+[^\"<\s.,\(\)\[\]\{\}!@+:%]/g;
    const target = new_window === true || new_window == null ? "_blank" : "";
    return text.replace(url_pattern, function (url) {
        return '<a href="' + url + '" target="' + target + '">' + url + "</a>";
    });
}

export function replaceNewlinesWithBrTags(text: string): string {
    return text.replace(/(?:\r\n|\r|\n)/g, "<br>");
}
