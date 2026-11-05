/* global window, document, location, history, crypto, TextEncoder, URLSearchParams */

// Runs Cloudflare Turnstile for one prize claim and passes what happens to the page that framed
// turnstile.html (HumanCheckFrame.svelte), which reads it as a HumanCheckMessage.
//
// The fragment carries the widget's site key and the claim's custom data (`sitekey`, `cdata`), which
// is "<user id>_<message id>". Cloudflare is given the SHA-256 in hex of that and a random salt, so it
// can't tie the check to the user. The salt goes back with each token, for the LocalUserIndex to
// check the token was issued for that claim. The fragment is cleared before Cloudflare's script runs
// on this page.
// Messages only go to the website itself and the apps, so a page elsewhere which frames this one
// can't collect tokens solved by its own visitors.
(async () => {
    const params = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, "", location.pathname);
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

    function hex(bytes) {
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    let salt;
    let cData;
    try {
        salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(`${params.get("cdata") ?? ""}_${salt}`),
        );
        cData = hex(new Uint8Array(digest));
    } catch {
        post({ kind: "turnstile_error", code: "hash_failed" });
        return;
    }

    window.onTurnstileLoad = () => {
        window.turnstile.render("#widget", {
            sitekey: params.get("sitekey"),
            action: "claim_prize",
            cData,
            appearance: "interaction-only",
            size: "flexible",
            callback: (token) => post({ kind: "turnstile_token", token, salt }),
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
