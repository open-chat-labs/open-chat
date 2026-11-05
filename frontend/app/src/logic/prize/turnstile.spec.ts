import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const CLAIM = "46qm5-fiaaa-aaaaf-br7x6-xca_12525619536623022000";
const SALT = "0123456789abcdef0123456789abcdef";
// The LocalUserIndex's custom data for this claim and salt (CUSTOM_DATA in turnstile.rs)
const CUSTOM_DATA = "506a8123758a87491d0b67f12ba5759b5e8ccc4f4911ab8172a68c56853977d2";

type RenderOptions = {
    sitekey: string;
    action: string;
    cData: string;
    callback: (token: string) => void;
};

// Runs public/turnstile.js, the human check's frame, with stand-ins for its page, the page that
// framed it and Cloudflare's script
async function runFrame(fragment: string) {
    const source = readFileSync(join(__dirname, "../../../public/turnstile.js"), "utf8");
    const posted: unknown[] = [];
    const location = { hash: fragment, pathname: "/turnstile.html", origin: "https://oc.app" };
    let options: RenderOptions | undefined;
    let fragmentAsCloudflareLoads: string | undefined;
    const window: Record<string, unknown> = {
        parent: {
            postMessage: (message: unknown, origin: string) => {
                if (origin === location.origin) posted.push(message);
            },
        },
        turnstile: { render: (_: string, o: RenderOptions) => (options = o) },
    };
    const document = {
        createElement: () => ({}),
        head: {
            appendChild: () => {
                fragmentAsCloudflareLoads = location.hash;
                (window.onTurnstileLoad as () => void)();
            },
        },
    };
    const history = {
        replaceState: (_state: unknown, _title: string, url: string) => {
            location.hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
        },
    };
    const crypto = {
        getRandomValues: (bytes: Uint8Array) => {
            for (let i = 0; i < bytes.length; i++) {
                bytes[i] = parseInt(SALT.slice(i * 2, i * 2 + 2), 16);
            }
            return bytes;
        },
        subtle: globalThis.crypto.subtle,
    };

    await runInNewContext(source, {
        window,
        document,
        location,
        history,
        crypto,
        TextEncoder,
        URLSearchParams,
    });
    return { options, posted, fragmentAsCloudflareLoads };
}

describe("the human check's frame", () => {
    test("gives Cloudflare the custom data the LocalUserIndex expects, and posts the salt back with the token", async () => {
        const { options, posted } = await runFrame(
            `#${new URLSearchParams({ sitekey: "key", cdata: CLAIM })}`,
        );

        expect(options?.sitekey).toBe("key");
        expect(options?.action).toBe("claim_prize");
        expect(options?.cData).toBe(CUSTOM_DATA);

        options?.callback("token");
        expect(posted).toEqual([{ kind: "turnstile_token", token: "token", salt: SALT }]);
    });

    test("clears the claim from its URL before Cloudflare's script loads", async () => {
        const { fragmentAsCloudflareLoads } = await runFrame(
            `#${new URLSearchParams({ sitekey: "key", cdata: CLAIM })}`,
        );

        expect(fragmentAsCloudflareLoads).toBe("");
    });
});
