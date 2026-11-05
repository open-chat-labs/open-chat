import { getMessageText, type Message, type OpenChat } from "@client";
import { translationCodes } from "@src/i18n/i18n";

/**
 * What asking to translate a message came to: `upgrade`, translating is for Diamond members (the
 * view offers the upgrade); `failed`, it couldn't be translated (the view says so,
 * `unableToTranslate`); `ok`, the translation shows in its place (`translationsStore`).
 */
export type TranslateOutcome = "upgrade" | "failed" | "ok";

/**
 * Translates a message's text into the app's language, as the old message menus did: for Diamond
 * members only, into `translationCodes[locale]` (English for a locale it doesn't list).
 */
export async function translateMessage(
    client: Pick<OpenChat, "translateMessage">,
    message: Pick<Message, "messageId" | "content">,
    reader: { diamond: boolean; locale: string | null | undefined },
): Promise<TranslateOutcome> {
    if (!reader.diamond) return "upgrade";
    const text = getMessageText(message.content);
    if (text === undefined) return "failed";
    const target = translationCodes[reader.locale || "en"] || "en";
    return (await client.translateMessage(message.messageId, text, target)) ? "ok" : "failed";
}
