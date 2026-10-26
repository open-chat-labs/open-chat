import { describe, expect, test } from "vitest";
// the app's marked config (links, code blocks), as Markdown.svelte renders with it
import "@src/utils/markdown";
import {
    extractCashtagSymbols,
    mentionedTokens,
    renderMarkdown,
    replaceCashtags,
    sameMentionedTokens,
    type MentionedToken,
} from "./markdownRender";

const noop = () => {};

const CHAT: MentionedToken = {
    symbol: "chat",
    tokenSymbol: "CHAT",
    subject: { kind: "token", ledger: "2ouva-viaaa-aaaaq-aaamq-cai" },
    price: "$0.0281",
    credit: undefined,
};
const ICP: MentionedToken = {
    symbol: "icp",
    tokenSymbol: "ICP",
    subject: { kind: "token", ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai" },
    price: "$2.58",
    credit: undefined,
};
const CKBTC: MentionedToken = {
    symbol: "ckbtc",
    tokenSymbol: "ckBTC",
    subject: { kind: "token", ledger: "mxzaz-hqaaa-aaaar-qaada-cai" },
    price: undefined,
    credit: undefined,
};
const RICH: MentionedToken = {
    symbol: "rich.ot",
    tokenSymbol: "RICH.OT",
    subject: { kind: "token", ledger: "rich-ledger" },
    price: "$1.50",
    credit: undefined,
};
// a coin OpenChat doesn't list, whose price must be credited
const ADA: MentionedToken = {
    symbol: "ada",
    tokenSymbol: "ADA",
    subject: { kind: "coin", id: "cardano" },
    price: "$0.205",
    credit: "Price data by CoinGecko",
};
const tokens = [CHAT, ICP, CKBTC, RICH, ADA];

const chat = `<cash-tag data-ledger="2ouva-viaaa-aaaaq-aaamq-cai" data-price="$0.0281" suppress-links="false">$CHAT</cash-tag>`;
const icp = `<cash-tag data-ledger="ryjl3-tyaaa-aaaaa-aaaba-cai" data-price="$2.58" suppress-links="false">$ICP</cash-tag>`;

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

    test("finds candidates whatever is around them, as markdown can change that", () => {
        expect(extractCashtagSymbols("_$CHAT_ and US$ICP")).toEqual(["chat", "icp"]);
    });

    test("allows punctuation around it", () => {
        expect(extractCashtagSymbols('($CHAT), $ICP! $ckBTC\'s "$CHAT"')).toEqual([
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

    test("are coins OpenChat doesn't list, with the credit their price needs", () => {
        expect(render("$ADA")).toBe(
            `<cash-tag data-coin="cardano" data-price="$0.205" data-credit="Price data by CoinGecko" suppress-links="false">$ADA</cash-tag>`,
        );
    });

    test("show no price when the token's price isn't known", () => {
        expect(render("$ckBTC")).toBe(
            `<cash-tag data-ledger="mxzaz-hqaaa-aaaar-qaada-cai" suppress-links="false">$ckBTC</cash-tag>`,
        );
    });

    test("keep the punctuation around them", () => {
        expect(render("($CHAT), $ICP! $CHAT's $ICP.")).toBe(`(${chat}), ${icp}! ${chat}'s ${icp}.`);
    });

    test("leave amounts alone", () => {
        expect(render("$5 or $5.20 for $CHAT")).toBe(`$5 or $5.20 for ${chat}`);
    });

    test("need to stand alone", () => {
        expect(render("US$CHAT a$ICP $$CHAT $CHAT_x $ICP$")).not.toContain("cash-tag");
    });

    test("work in emphasis made with underscores", () => {
        expect(render("_$CHAT_ and __$ICP__")).toBe(`<em>${chat}</em> and <strong>${icp}</strong>`);
    });

    test("leave unknown symbols as text", () => {
        expect(render("$FOO and $CHATTY")).toBe("$FOO and $CHATTY");
    });

    test("leave code spans and code blocks alone", () => {
        expect(render("`$CHAT` and $CHAT")).toBe(`<code>$CHAT</code> and ${chat}`);
        const block = render("```\nbuy $CHAT\n```\n$ICP", false);
        expect(block).not.toContain('<cash-tag data-ledger="2ouva-viaaa-aaaaq-aaamq-cai');
        expect(block).toContain(icp);
    });

    test("leave links alone", () => {
        expect(render("[buy $CHAT](https://example.com) $ICP")).not.toContain(
            "2ouva-viaaa-aaaaq-aaamq-cai",
        );
        expect(render("[buy $CHAT](https://example.com) $ICP")).toContain(icp);
        expect(render("https://example.com/$CHAT")).not.toContain("cash-tag");
    });

    test("leave spoilers alone, which render out of reach of the chip's styles", () => {
        expect(render("||$CHAT is up|| $ICP")).toBe(
            `<spoiler-span>$CHAT is up</spoiler-span> ${icp}`,
        );
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
        expect(
            sameMentionedTokens(
                tokens,
                tokens.map((t) => ({ ...t })),
            ),
        ).toBe(true);
    });

    test("differs on what it is, or the credit", () => {
        expect(
            sameMentionedTokens([CHAT], [{ ...CHAT, subject: { kind: "coin", id: "chat" } }]),
        ).toBe(false);
        expect(sameMentionedTokens([ADA], [{ ...ADA, credit: undefined }])).toBe(false);
    });

    test("differs on the price shown, not on the number behind it", () => {
        expect(sameMentionedTokens([CHAT], [{ ...CHAT, price: "$0.0282" }])).toBe(false);
    });
});

describe("mentionedTokens", () => {
    const tokensBySymbol = new Map([["chat", { symbol: "CHAT", ledger: "chat-ledger" }]]);
    const rates = new Map([["chat-ledger", { toUSD: 0.0281, source: "icpswap" }]]);
    const coins = new Map([
        ["ada", { id: "cardano", symbol: "ADA", name: "Cardano", usd: 0.205, source: "coingecko" }],
        // a coin with a listed token's symbol, as on a test env whose Registry isn't prod's
        ["chat", { id: "solchat", symbol: "CHAT", name: "SolChat", usd: 0.5, source: "coingecko" }],
    ]);
    const credit = (source: string | undefined) =>
        source === "coingecko" ? "Price data by CoinGecko" : undefined;

    test("takes a token OpenChat lists over a coin with its symbol", () => {
        expect(mentionedTokens(["chat"], tokensBySymbol, rates, coins, credit)).toEqual([
            {
                symbol: "chat",
                tokenSymbol: "CHAT",
                subject: { kind: "token", ledger: "chat-ledger" },
                price: "$0.0281",
                credit: undefined,
            },
        ]);
    });

    test("takes one of the largest coins for any other symbol, with its price's credit", () => {
        expect(mentionedTokens(["ada"], tokensBySymbol, rates, coins, credit)).toEqual([
            {
                symbol: "ada",
                tokenSymbol: "ADA",
                subject: { kind: "coin", id: "cardano" },
                price: "$0.205",
                credit: "Price data by CoinGecko",
            },
        ]);
    });

    test("leaves out symbols that are neither", () => {
        expect(mentionedTokens(["foo"], tokensBySymbol, rates, coins, credit)).toEqual([]);
    });

    test("gives a token with no price no price", () => {
        expect(
            mentionedTokens(["chat"], tokensBySymbol, new Map(), coins, credit)[0].price,
        ).toBeUndefined();
    });
});
