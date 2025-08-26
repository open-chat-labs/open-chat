import { writable } from "svelte/store";
import { Database as EmojiDatabase } from "emoji-picker-element";
import type { Emoji } from "emoji-picker-element/shared";

const emojiDb = new EmojiDatabase();
const showQuickReactionCount = 3;
const defaultReactions = ["yes", "tears_of_joy", "pray"];

function initQuickReactions() {

    // Filter the reactions by taking into account the appropriate skin tone.
    function getUnicodeBySkintone(skintone: number, reactions: Emoji[]): string[] {
        return reactions.map((emoji) => {
            if ("unicode" in emoji) {
                return undefined === emoji.skins || 0 === skintone
                    ? emoji.unicode
                    : emoji.skins.find((val) => val.tone === skintone ? val.unicode : null)?.unicode
            }
        })
        .filter((u) => u !== undefined) as string[];
    }

    function loadQuickReactions(skintone: number) {
        return emojiDb
            .getTopFavoriteEmoji(showQuickReactionCount)
            .then((fav) => {
                const favUnicode = getUnicodeBySkintone(skintone, fav);
                
                // If we have less emoji than we want to show, expand with
                // a default selection of emoji.
                if (fav.length < showQuickReactionCount) {
                    return Promise.all(
                        defaultReactions.map((em) => emojiDb.getEmojiByShortcode(em)),
                    )
                        .then((def) => getUnicodeBySkintone(skintone, def.filter((v) => v != null) as Emoji[]))
                        .then((defUnicode) => [...new Set(favUnicode.concat(defUnicode))].slice(0, showQuickReactionCount))
                }

                return favUnicode;
            }).catch((e) => {
                console.log(e);
                return ([] as string[]);
            });
    }

    function loadSkintoneAndQuickReactions() {
        return emojiDb
            .getPreferredSkinTone()
            .then(loadQuickReactions);
    }

    const { subscribe, set } = writable<string[]>([]);
    loadSkintoneAndQuickReactions().then(set);

    return {
        subscribe,

        // Increment favourites
        incrementFavourite: (unicode: string): void => {
            emojiDb.incrementFavoriteEmojiCount(unicode);
        },

        // Reload reactions
        reload: (skintone?: number): void => {
            (skintone
                ? loadQuickReactions(skintone)
                : loadSkintoneAndQuickReactions()
            ).then(set);
        },
    };
}

export const quickReactions = initQuickReactions();
