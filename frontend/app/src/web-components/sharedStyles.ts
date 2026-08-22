// Returns a function that applies `css` to a shadow root. Browsers that
// support constructable stylesheets share a single CSSStyleSheet across every
// instance via adoptedStyleSheets; otherwise a <style> element is appended.
export function sharedStyles(css: string): (shadow: ShadowRoot) => void {
    let sheet: CSSStyleSheet | undefined;
    return (shadow) => {
        if ("adoptedStyleSheets" in shadow && "replaceSync" in CSSStyleSheet.prototype) {
            if (sheet === undefined) {
                sheet = new CSSStyleSheet();
                sheet.replaceSync(css);
            }
            shadow.adoptedStyleSheets = [sheet];
        } else {
            const style = document.createElement("style");
            style.textContent = css;
            shadow.appendChild(style);
        }
    };
}
