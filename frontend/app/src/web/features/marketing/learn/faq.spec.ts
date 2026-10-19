import { allQuestions } from "@client";
import { answerText, faqGroups } from "./faq";

describe("an old FAQ answer as Learn text", () => {
    test("keeps links as markdown links, and drops other markup for its text", () => {
        expect(
            answerText(
                'Files are in <a target="_blank" href="https://github.com/open-chat-labs/open-storage">OpenStorage</a>, not <em>chats</em>.',
            ),
        ).toBe(
            "Files are in [OpenStorage](https://github.com/open-chat-labs/open-storage), not chats.",
        );
    });

    test("turns line breaks into lines, and two into a paragraph break", () => {
        expect(answerText("Commands: <br /><br /> `/poll` - a poll <br /> `/gif x` - a gif")).toBe(
            "Commands:\n\n`/poll` - a poll\n`/gif x` - a gif",
        );
    });

    test("puts a list's items on lines of their own, after a paragraph break", () => {
        expect(answerText("The fees are: <ul><li>CHAT 0.001</li><li>ICP 0.0001</li></ul>")).toBe(
            "The fees are:\n\n• CHAT 0.001\n• ICP 0.0001",
        );
        expect(answerText("<ol><li>one</li><li>two</li></ol>")).toBe("1. one\n2. two");
    });

    test("keeps every cell of a table, a row to a line", () => {
        expect(
            answerText(
                "<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Diamond</td><td>15 CHAT</td></tr></table>",
            ),
        ).toBe("Plan · Price\nDiamond · 15 CHAT");
    });

    test("leaves at most one blank line between paragraphs", () => {
        expect(answerText("Fees: <br /><br /><ul><li>CHAT</li></ul><br /><br />Done")).toBe(
            "Fees:\n\n• CHAT\n\nDone",
        );
    });

    test("bold stays bold", () => {
        expect(answerText("<strong>Note</strong> this")).toBe("**Note** this");
    });
});

describe("the FAQs", () => {
    test("are every question, in order, from the translations, with its key as its id", () => {
        const [group] = faqGroups((key) => `<em>${key}</em>`);
        expect(group.items.map((it) => it.id)).toEqual([...allQuestions]);
        expect(group.items[0]).toEqual({
            id: "wallet",
            q: "<em>faq.wallet_q</em>",
            a: "faq.wallet_a",
        });
    });
});
