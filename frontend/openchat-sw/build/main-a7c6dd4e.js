
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
function updateStatus(message) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
        statusEl.innerText = message;
    }
}
function registerServiceWorker() {
    window.addEventListener("load", async () => {
        // Verify user's web browser has necessary support
        const unsupported = [
            ["serviceWorker", window.navigator.serviceWorker],
            ["BigInt", window.BigInt],
            ["WebAssembly", window.WebAssembly],
        ]
            .filter((tuple) => !tuple[1])
            .map((tuple) => tuple[0])
            .join(", ");
        if (unsupported) {
            updateStatus(`This web browser cannot interact with the Internet Computer securely.  (No: ${unsupported})
       Please try new web browser software.`);
            return;
        }
        console.log(`Installing the service worker`);
        // Ok, let's install the service worker...
        // note: if the service worker was already installed, when the browser requested <domain>/, it would have
        // proxied the response from <domain>/<canister-id>/, so this bootstrap file would have never been
        // retrieved from the boundary nodes
        await navigator.serviceWorker.register("/sw.js");
        // delays code execution until serviceworker is ready
        await navigator.serviceWorker.ready;
        // // reload the page so the service worker can intercept the requests
        window.location.reload();
    });
}

registerServiceWorker();
//# sourceMappingURL=main-a7c6dd4e.js.map
