// Returns a function that applies `css` to a shadow root. Browsers that
// support constructable stylesheets share a single CSSStyleSheet across every
// instance via adoptedStyleSheets; otherwise (or if that path throws on an
// engine that exposes the API but does not fully support it) a <style> element
// is appended.
export function sharedStyles(css: string): (shadow: ShadowRoot) => void {
    let sheet: CSSStyleSheet | undefined;
    return (shadow) => {
        if ("adoptedStyleSheets" in shadow && "replaceSync" in CSSStyleSheet.prototype) {
            try {
                if (sheet === undefined) {
                    const s = new CSSStyleSheet();
                    s.replaceSync(css);
                    sheet = s;
                }
                shadow.adoptedStyleSheets = [sheet];
                return;
            } catch {
                // fall through to the <style> element
            }
        }
        const style = document.createElement("style");
        style.textContent = css;
        shadow.appendChild(style);
    };
}
