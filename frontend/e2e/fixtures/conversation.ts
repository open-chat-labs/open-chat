import { expect } from "@playwright/test";
import type { User } from "./users";

/** Sends a text message in the open chat, as a person on that tree would. */
export async function sendText(user: User, text: string): Promise<void> {
    const box = user.page.getByPlaceholder(/message/i);
    await box.fill(text);
    if (user.tree === "v3") {
        await box.press("Enter");
    } else {
        // on a phone Enter starts a new line
        await user.page.getByRole("button", { name: "Send message" }).click();
    }
}

/** Waits for a message with exactly `text` to show in the open chat. */
export async function expectMessage(user: User, text: string): Promise<void> {
    // the chat list's preview can be in the page too, behind the conversation on a phone
    await expect(
        user.page.getByText(text, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
}
