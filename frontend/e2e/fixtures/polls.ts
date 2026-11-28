import { expect, type Locator } from "@playwright/test";
import type { User } from "./users";

/**
 * Posts a poll in a group through `author`'s client: the setup for specs about voting. Making a poll
 * in the builder is its own spec. Its votes are visible as they come in, and a vote can be changed.
 */
export async function postPoll(
    author: User,
    groupId: string,
    question: string,
    answers: string[],
): Promise<void> {
    const outcome = await author.page.evaluate(
        async ({ groupId, question, answers }) => {
            const client = window.__ocTest!.client;
            const day = 24 * 60 * 60 * 1000;
            return client.sendContent(
                { chatId: { kind: "group_chat", groupId } },
                {
                    kind: "poll_content",
                    votes: { total: { kind: "visible_poll_votes", votes: {} }, user: [] },
                    config: {
                        allowMultipleVotesPerUser: false,
                        allowUserToChangeVote: true,
                        text: question,
                        showVotesBeforeEndDate: true,
                        endDate: BigInt(Date.now() + day),
                        anonymous: false,
                        options: answers,
                    },
                    ended: false,
                },
            );
        },
        { groupId, question, answers },
    );
    expect(outcome.kind).toBe("posted");
}

/** The open chat's poll whose question is `question`. */
export function poll(user: User, question: string): Locator {
    return user.page.getByRole("group").filter({ hasText: question }).last();
}

/**
 * One of the poll's answers, named by its label and then its share: a radio, or a checkbox in a
 * poll that takes several answers.
 */
export function pollAnswer(
    user: User,
    question: string,
    answer: string,
    role: "radio" | "checkbox" = "radio",
): Locator {
    return poll(user, question).getByRole(role, { name: new RegExp(`^${answer}\\b`) });
}
