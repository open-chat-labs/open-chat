/* global window, document, location, history, crypto, TextEncoder, URLSearchParams */

// Runs Cloudflare Turnstile for one prize claim and passes what happens to the page that framed
// turnstile.html (HumanCheckFrame.svelte), which reads it as a HumanCheckMessage.
//
// The fragment carries the widget's site key and the claim's custom data (`sitekey`, `cdata`), which
// is "<user id>_<message id>". Cloudflare is given its SHA-256 in hex rather than the user's id, and
// the LocalUserIndex checks the hash, so a token only serves that claim. The fragment is cleared
// before Cloudflare's script runs on this page.
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

    let cData;
    try {
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(params.get("cdata") ?? ""),
        );
        cData = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
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
