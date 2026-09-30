const MEME_MAKER_URL = "https://maker.memefighter.app";
export const MEME_MAKER_ORIGIN = new URL(MEME_MAKER_URL).origin;

// How the maker is asked to look
export type MemeMakerStyle = {
    "--background-color"?: string;
    "--foreground-color"?: string;
    "--button-color"?: string;
};

// Loads the Meme Fighter maker into `iframe` and calls `onMemeCreated` with the url of the meme
// the user makes there. Returns the function which stops listening for it.
//
// This speaks the protocol of @memefighter/maker-core, which it replaces: that package pulled
// zod into the bundle to check three message shapes, and its listener took a MEME_CREATED url
// from any window able to post to ours. The maker posts READY once it has loaded and is answered
// with INIT carrying the style. It replies with INIT_RESPONSE, and posts MEME_CREATED with the
// meme's url once the user has made one.
export function startMemeMaker(
    iframe: HTMLIFrameElement,
    style: MemeMakerStyle,
    onMemeCreated: (url: string) => void,
): () => void {
    function onMessage(ev: MessageEvent) {
        // Only the maker, in the frame it was loaded into, gets a say. Other windows can post to
        // ours too: an external content frame, a popup, the parent when OpenChat is embedded.
        // A frame which has left the document has no window, and nor has a message whose sender
        // has gone, so those two must not be taken to match.
        const maker = iframe.contentWindow;
        if (ev.origin !== MEME_MAKER_ORIGIN || maker === null || ev.source !== maker) return;

        const data = ev.data;
        if (typeof data !== "object" || data === null) return;

        switch (data.messageType) {
            case "READY":
                maker.postMessage({ messageType: "INIT", payload: style }, MEME_MAKER_ORIGIN);
                break;
            case "INIT_RESPONSE":
                if (data.payload?.status !== "ok") {
                    console.error("Meme Fighter failed to initialise", data.payload?.err);
                }
                break;
            case "MEME_CREATED":
                if (typeof data.payload === "string" && data.payload !== "") {
                    stop();
                    onMemeCreated(data.payload);
                }
                break;
        }
    }

    function stop() {
        window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    // the maker sends the meme as soon as it is made rather than showing its own insert button
    iframe.src = `${MEME_MAKER_URL}?skipInsertButton=true`;
    return stop;
}
