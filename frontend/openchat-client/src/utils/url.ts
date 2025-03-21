// Taken from here - https://stackoverflow.com/a/6041965
const URL_REGEX = new RegExp((`(https?):\\/\\/([\\w_-]+(?:(?:\\.[\\w_-]+)+))([\\w.,@?^=%&:\\/~+#-]*[\\w@?^=%&\\/~+#-])`), "g");

export function extractUrls(text: string): string[] {
    const matches = text.match(URL_REGEX);
    if (!matches) return [];

    return [...matches.reduce((set, next) => {
        set.add(next);
        return set;
    }, new Set<string>())];
}

export function addQueryStringParam(name: string, val: string): string {
    const path = window.location.pathname;
    const qs = new URLSearchParams(window.location.search);
    qs.set(name, val);
    return [...qs.keys()].length > 0 ? `${path}?${qs}` : path;
}
