// Taken from https://stackoverflow.com/a/13824103
export function removeFragment() {
    window.location.replace("#");

    // slice off the remaining "#" in HTML5:
    if (typeof window.history.replaceState === "function") {
        history.replaceState({}, "", window.location.href.slice(0, -1));
    }
}

export function extractQueryStringAsObject(): any {
    const search = location.search.substring(1);
    return search.length
        ? JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}')
        : {};
}