import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MEME_MAKER_ORIGIN, startMemeMaker } from "./memeFighter";

const style = { "--background-color": "#1b1c21", "--button-color": "#22a7f2" };

describe("startMemeMaker", () => {
    let iframe: HTMLIFrameElement;
    let postToMaker: ReturnType<typeof vi.fn>;
    let onMemeCreated: ReturnType<typeof vi.fn<(url: string) => void>>;
    let stop: () => void;

    // A message as the maker posts it: from its own origin, out of the frame it was loaded into
    function fromMaker(data: unknown) {
        post({ origin: MEME_MAKER_ORIGIN, source: iframe.contentWindow, data });
    }

    function post(init: MessageEventInit) {
        window.dispatchEvent(new MessageEvent("message", init));
    }

    beforeEach(() => {
        iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        onMemeCreated = vi.fn();
        stop = startMemeMaker(iframe, style, onMemeCreated);
        // after starting: jsdom gives the frame a new window when its src is set
        postToMaker = vi.fn();
        iframe.contentWindow!.postMessage = postToMaker as unknown as Window["postMessage"];
    });

    afterEach(() => {
        stop();
        iframe.remove();
        vi.restoreAllMocks();
    });

    test("answers the maker's READY with the style, addressed to the maker alone", () => {
        fromMaker({ messageType: "READY" });
        expect(postToMaker).toHaveBeenCalledExactlyOnceWith(
            { messageType: "INIT", payload: style },
            MEME_MAKER_ORIGIN,
        );
    });

    test("hands over the url of the meme the maker creates", () => {
        fromMaker({ messageType: "MEME_CREATED", payload: "https://memefighter.app/meme.png" });
        expect(onMemeCreated).toHaveBeenCalledExactlyOnceWith("https://memefighter.app/meme.png");
    });

    test("stops listening once it has a meme", () => {
        fromMaker({ messageType: "MEME_CREATED", payload: "https://memefighter.app/one.png" });
        fromMaker({ messageType: "MEME_CREATED", payload: "https://memefighter.app/two.png" });
        expect(onMemeCreated).toHaveBeenCalledTimes(1);
    });

    // Invariant: only the maker, in the frame it was loaded into, can drive the protocol.
    test("ignores protocol messages from any other origin", () => {
        for (const origin of ["https://evil.example.com", "null", window.location.origin]) {
            post({ origin, source: iframe.contentWindow, data: { messageType: "READY" } });
            post({
                origin,
                source: iframe.contentWindow,
                data: { messageType: "MEME_CREATED", payload: "https://evil.example.com/x.png" },
            });
        }
        expect(postToMaker).not.toHaveBeenCalled();
        expect(onMemeCreated).not.toHaveBeenCalled();
    });

    test("ignores the maker's origin speaking from another window", () => {
        const other = document.createElement("iframe");
        document.body.appendChild(other);
        const data = { messageType: "MEME_CREATED", payload: "https://memefighter.app/meme.png" };
        post({ origin: MEME_MAKER_ORIGIN, source: other.contentWindow, data });
        post({ origin: MEME_MAKER_ORIGIN, source: window, data });
        post({ origin: MEME_MAKER_ORIGIN, data });
        expect(onMemeCreated).not.toHaveBeenCalled();
        other.remove();
    });

    test("ignores a meme whose url is missing, empty or not a string, and keeps listening", () => {
        fromMaker({ messageType: "MEME_CREATED", payload: { url: "https://memefighter.app/x" } });
        fromMaker({ messageType: "MEME_CREATED", payload: "" });
        fromMaker({ messageType: "MEME_CREATED" });
        expect(onMemeCreated).not.toHaveBeenCalled();
        fromMaker({ messageType: "MEME_CREATED", payload: "https://memefighter.app/meme.png" });
        expect(onMemeCreated).toHaveBeenCalledTimes(1);
    });

    // Invariant: a frame which has left the document, and so has no window, is not matched by a
    // message with no source.
    test("ignores the maker's origin once the frame has left the document", () => {
        vi.spyOn(iframe, "contentWindow", "get").mockReturnValue(null);
        post({
            origin: MEME_MAKER_ORIGIN,
            source: null,
            data: { messageType: "MEME_CREATED", payload: "https://memefighter.app/meme.png" },
        });
        expect(onMemeCreated).not.toHaveBeenCalled();
    });

    test("ignores messages which are not part of the protocol", () => {
        fromMaker(null);
        fromMaker("READY");
        fromMaker({ messageType: "SOMETHING_ELSE" });
        fromMaker({ kind: "external_content_ready" });
        expect(postToMaker).not.toHaveBeenCalled();
        expect(onMemeCreated).not.toHaveBeenCalled();
    });

    test("stops listening when asked to", () => {
        stop();
        fromMaker({ messageType: "READY" });
        fromMaker({ messageType: "MEME_CREATED", payload: "https://memefighter.app/meme.png" });
        expect(postToMaker).not.toHaveBeenCalled();
        expect(onMemeCreated).not.toHaveBeenCalled();
    });
});
