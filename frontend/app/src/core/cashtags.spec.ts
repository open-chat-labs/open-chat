import { describe, expect, test } from "vitest";
// the app's marked config (links, code blocks), as Markdown.svelte renders with it
import "@src/utils/markdown";
import {
    extractCashtagSymbols,
    renderMarkdown,
    replaceCashtags,
    sameMentionedTokens,
    type MentionedToken,
} from "./markdownRender";

const noop = () => {};

const CHAT: MentionedToken = {
    symbol: "chat",
    tokenSymbol: "CHAT",
    ledger: "2ouva-viaaa-aaaaq-aaamq-cai",
    usd: 0.0281,
};
const ICP: MentionedToken = {
    symbol: "icp",
    tokenSymbol: "ICP",
    ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
    usd: 2.58,
};
const CKBTC: MentionedToken = {
    symbol: "ckbtc",
    tokenSymbol: "ckBTC",
    ledger: "mxzaz-hqaaa-aaaar-qaada-cai",
    usd: undefined,
};
const RICH: MentionedToken = {
    symbol: "rich.ot",
    tokenSymbol: "RICH.OT",
    ledger: "rich-ledger",
    usd: 1.5,
};
const tokens = [CHAT, ICP, CKBTC, RICH];

const chat = `<cash-tag data-ledger="${CHAT.ledger}" data-price="$0.0281" suppress-links="false">$CHAT</cash-tag>`;
const icp = `<cash-tag data-ledger="${ICP.ledger}" data-price="$2.58" suppress-links="false">$ICP</cash-tag>`;

function render(text: string, inline = true, suppressLinks = false): string {
    return renderMarkdown(
        { text, inline, oneLine: false, suppressLinks, users: [], userGroups: [], tokens },
        noop,
    );
}

describe("extractCashtagSymbols", () => {
    test("finds each symbol once, in lower case, in order", () => {
        expect(extractCashtagSymbols("$CHAT and $icp, then $Chat again")).toEqual(["chat", "icp"]);
    });

    test("finds none in text with no $", () => {
        expect(extractCashtagSymbols("CHAT and ICP")).toEqual([]);
    });

    test("takes amounts for amounts, not cashtags", () => {
        expect(extractCashtagSymbols("$5, $5.20, $5k and $1B")).toEqual([]);
    });

    test("needs the cashtag to stand alone", () => {
        expect(extractCashtagSymbols("US$CHAT a$ICP $$CHAT $CHAT_x $ICP$")).toEqual([]);
    });

    test("allows punctuation around it", () => {
        expect(extractCashtagSymbols("($CHAT), $ICP! $ckBTC's \"$CHAT\"")).toEqual([
            "chat",
            "icp",
            "ckbtc",
        ]);
    });

    test("finds one at the start of a line", () => {
        expect(extractCashtagSymbols("hi\n$CHAT")).toEqual(["chat"]);
    });

    test("leaves a dot that ends the sentence out of the symbol", () => {
        expect(extractCashtagSymbols("I hold $CHAT.")).toEqual(["chat"]);
    });

    test("gives a symbol with dots, and each shorter one up to a dot", () => {
        expect(extractCashtagSymbols("$RICH.OT")).toEqual(["rich.ot", "rich"]);
        expect(extractCashtagSymbols("$CHAT.Nice.Day")).toEqual([
            "chat.nice.day",
            "chat.nice",
            "chat",
        ]);
    });
});

describe("cashtags in rendered messages", () => {
    test("become chips showing the token's price", () => {
        expect(render("$CHAT is up")).toBe(`${chat} is up`);
    });

    test("match the symbol whatever its case, and show the token's own", () => {
        expect(render("$chat")).toBe(chat);
        expect(render("$CKBTC")).toContain(">$ckBTC</cash-tag>");
    });

    test("show no price when the token's price isn't known", () => {
        expect(render("$ckBTC")).toBe(
            `<cash-tag data-ledger="${CKBTC.ledger}" suppress-links="false">$ckBTC</cash-tag>`,
        );
    });

    test("keep the punctuation around them", () => {
        expect(render("($CHAT), $ICP! $CHAT's $ICP.")).toBe(
            `(${chat}), ${icp}! ${chat}'s ${icp}.`,
        );
    });

    test("leave amounts alone", () => {
        expect(render("$5 or $5.20 for $CHAT")).toBe(`$5 or $5.20 for ${chat}`);
    });

    test("leave unknown symbols as text", () => {
        expect(render("$FOO and $CHATTY")).toBe("$FOO and $CHATTY");
    });

    test("leave code spans and code blocks alone", () => {
        expect(render("`$CHAT` and $CHAT")).toBe(`<code>$CHAT</code> and ${chat}`);
        const block = render("```\nbuy $CHAT\n```\n$ICP", false);
        expect(block).not.toContain("<cash-tag data-ledger=\"" + CHAT.ledger);
        expect(block).toContain(icp);
    });

    test("leave links alone", () => {
        expect(render("[buy $CHAT](https://example.com) $ICP")).not.toContain(CHAT.ledger);
        expect(render("[buy $CHAT](https://example.com) $ICP")).toContain(icp);
        expect(render("https://example.com/$CHAT")).not.toContain("cash-tag");
    });

    test("work inside emphasis", () => {
        expect(render("**$CHAT**")).toBe(`<strong>${chat}</strong>`);
    });

    test("fall back to the symbol before a dot when the whole isn't known", () => {
        expect(render("$CHAT.Nice")).toBe(`${chat}.Nice`);
        expect(render("$RICH.OT")).toContain(">$RICH.OT</cash-tag>");
    });

    test("aren't clickable where links are suppressed", () => {
        expect(render("$CHAT", true, true)).toContain(`suppress-links="true"`);
    });

    test("are left alone when no token was found", () => {
        expect(replaceCashtags("$CHAT", [], false)).toBe("$CHAT");
    });
});

describe("sameMentionedTokens", () => {
    test("is equal by value", () => {
        expect(sameMentionedTokens(tokens, tokens.map((t) => ({ ...t })))).toBe(true);
    });

    test("differs on a price", () => {
        expect(sameMentionedTokens([CHAT], [{ ...CHAT, usd: 0.03 }])).toBe(false);
    });
});
