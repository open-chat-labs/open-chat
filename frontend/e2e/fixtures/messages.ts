import { expect, type Locator } from "@playwright/test";
import type { Tree, User } from "./users";

/** A message's menu items, by what they do, as each tree labels them. */
const MENU_ITEMS = {
    reply: { desktop: "Quote reply", mobile: "Reply" },
    edit: { desktop: "Edit", mobile: "Edit" },
    delete: { desktop: "Delete", mobile: "Delete" },
    forward: { desktop: "Forward", mobile: "Forward" },
    thread: { desktop: "Reply in thread", mobile: "Reply in thread" },
    pin: { desktop: "Pin", mobile: "Pin" },
    unpin: { desktop: "Unpin", mobile: "Unpin" },
} satisfies Record<string, Record<Tree, string>>;

export type MessageMenuItem = keyof typeof MENU_ITEMS;

/**
 * The open chat's message containing `text` (a spec's texts are unique). Not an exact match: a
 * caption shares its paragraph with the message's time.
 */
export function messageRow(user: User, text: string): Locator {
    return user.page.getByRole("group").filter({ hasText: text }).last();
}

/** The message menu of the open chat's message `text` (right-click, which both trees take). */
function messageMenu(user: User): Locator {
    return user.page.getByRole("menu", {
        name: user.tree === "desktop" ? "Message actions" : "Message options",
    });
}

/**
 * Opens the message's menu and waits for `ready` in it. A message that has only just arrived can
 * come straight from the sender's device, before the backend has confirmed it, and its menu only
 * offers some things once it has (messageMenu's `live`), so the menu is opened again until then.
 */
async function openMessageMenu(user: User, text: string, ready: Locator): Promise<void> {
    await expect(async () => {
        if (await messageMenu(user).isVisible()) await user.page.keyboard.press("Escape");
        await messageRow(user, text).click({ button: "right" });
        await expect(ready).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
}

function menuItem(user: User, item: MessageMenuItem): Locator {
    return messageMenu(user).getByRole("menuitem", {
        name: MENU_ITEMS[item][user.tree],
        exact: true,
    });
}

/** Picks `item` from the menu of the open chat's message `text`. */
export async function messageAction(
    user: User,
    text: string,
    item: MessageMenuItem,
): Promise<void> {
    await openMessageMenu(user, text, menuItem(user, item));
    await menuItem(user, item).click();
}

/**
 * Adds (or, `remove`, takes back) one of the menu's quick reactions to the open chat's message
 * `text`.
 */
export async function react(
    user: User,
    text: string,
    emoji: string,
    remove = false,
): Promise<void> {
    // desktop's reactions are in the menu; mobile's in a bar above it
    // the app's emoji data comes from a CDN, whose emoji may or may not end in U+FE0F (1.9.0 dropped
    // it from 👍), so `emoji` is given without it and matched either way
    const reaction = user.page.getByRole(user.tree === "desktop" ? "menuitemcheckbox" : "button", {
        name: new RegExp(`^${remove ? "Remove" : "React"} ${emoji}\uFE0F?$`, "u"),
    });
    await openMessageMenu(user, text, reaction);
    await reaction.click();
}

/**
 * Edits the user's own message `text` to `edited`, from its menu, as soon as the menu offers Edit
 * (only once the backend has confirmed the message, #10568).
 */
export async function editMessage(user: User, text: string, edited: string): Promise<void> {
    await messageAction(user, text, "edit");
    // the composer takes the message's text: wait for it, or it lands over what's typed next
    await expect.poll(() => composerText(user)).toBe(text);
    await composer(user).fill(edited);
    await submit(user, true);
}

/** Quote-replies to the open chat's message `text` with `reply`, from its menu. */
export async function replyTo(user: User, text: string, reply: string): Promise<void> {
    await messageAction(user, text, "reply");
    await expect(user.page.getByRole("status", { name: /^Replying to/ })).toBeVisible();
    await composer(user).fill(reply);
    await submit(user);
}

/** Forwards the message whose Forward was just picked to the chat named `chatName`. */
export async function forwardTo(user: User, chatName: string): Promise<void> {
    const dialog = user.page.getByRole("dialog", { name: "Forward" });
    await dialog.getByRole("searchbox", { name: "Search chats" }).fill(chatName);
    await dialog.getByRole("option", { name: chatName }).click();
    // mobile forwards to several chats at once
    await dialog
        .getByRole("button", {
            name: user.tree === "desktop" ? "Forward" : "Forward to 1 chat",
            exact: true,
        })
        .click();
}

// a 16×16 PNG
const PHOTO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YRRAEmIY1TCqYfhqAADop0oQdRM5SAAAAABJRU5ErkJggg==",
    "base64",
);

/** Sends a photo with `caption` in the open chat, picked through the composer's attach menu. */
export async function sendPhoto(user: User, caption: string): Promise<void> {
    const page = user.page;
    await page.getByRole("button", { name: "Add to message" }).click();
    const chooser = page.waitForEvent("filechooser");
    if (user.tree === "desktop") {
        await page.getByRole("menuitem", { name: "Photo or video" }).click();
    } else {
        await page.getByRole("button", { name: "Photos & videos" }).click();
    }
    await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: PHOTO });
    const box = page.getByRole("textbox", { name: /caption/i });
    await box.fill(caption);
    if (user.tree === "desktop") {
        await box.press("Enter");
    } else {
        await page.getByRole("button", { name: "Send message" }).click();
    }
}

/** Confirms deleting a message. */
export async function confirmDelete(user: User): Promise<void> {
    const dialog = user.page.getByRole(user.tree === "desktop" ? "dialog" : "alertdialog", {
        name: "Do you really want to delete this message?",
    });
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
}

/** Sends a text message in the open chat, as a person on that tree would. */
export async function sendText(user: User, text: string): Promise<void> {
    await composer(user).fill(text);
    await submit(user);
}

/**
 * Waits for the message `text` to show in the open chat's conversation (not just in the chat
 * list's preview of it).
 */
export async function expectMessage(user: User, text: string): Promise<void> {
    await expect(messageRow(user, text)).toBeVisible();
}

/**
 * The composer's text box: the rich-text editor (#10576), or the plain text box it stands in for
 * until its code has loaded. Both are named by the placeholder.
 */
export function composer(user: User): Locator {
    return user.page.getByRole("textbox", { name: /message/i });
}

/** The text in the composer's text box, whichever it is. */
export async function composerText(user: User): Promise<string> {
    return composer(user).evaluate((el) =>
        el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? ""),
    );
}

/** Sends what's in the composer: Enter on desktop, the send (or save) button on a phone. */
export async function submit(user: User, editing = false): Promise<void> {
    if (user.tree === "desktop") {
        await composer(user).press("Enter");
    } else {
        await user.page
            .getByRole("button", { name: editing ? "Save edit" : "Send message" })
            .click();
    }
}
