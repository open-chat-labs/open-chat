/* global window, document, location, URLSearchParams */

// Runs Cloudflare Turnstile for one prize claim and passes what happens to the page that framed
// turnstile.html (HumanCheckFrame.svelte), which reads it as a HumanCheckMessage.
//
// The fragment carries the widget's site key and custom data (`sitekey`, `cdata`). The custom data
// names the user and the prize, and the LocalUserIndex checks it, so a token only serves that claim.
// Messages only go to the website itself and the apps, so a page elsewhere which frames this one
// can't collect tokens solved by its own visitors.
(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const parents = [location.origin, "tauri://localhost", "http://tauri.localhost"];

    function post(message) {
        for (const origin of parents) {
            try {
                window.parent.postMessage(message, origin);
            } catch {
                // An origin the browser can't parse
            }
        }
    }

    window.onTurnstileLoad = () => {
        window.turnstile.render("#widget", {
            sitekey: params.get("sitekey"),
            action: "claim_prize",
            cData: params.get("cdata"),
            appearance: "interaction-only",
            size: "flexible",
            callback: (token) => post({ kind: "turnstile_token", token }),
            "expired-callback": () => post({ kind: "turnstile_expired" }),
            "before-interactive-callback": () => post({ kind: "turnstile_interactive" }),
            "error-callback": (code) => post({ kind: "turnstile_error", code: String(code) }),
            "timeout-callback": () => post({ kind: "turnstile_error", code: "timeout" }),
            "unsupported-callback": () => post({ kind: "turnstile_error", code: "unsupported" }),
        });
    };

    const script = document.createElement("script");
    script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    script.async = true;
    script.onerror = () => post({ kind: "turnstile_error", code: "script_blocked" });
    document.head.appendChild(script);
})();
