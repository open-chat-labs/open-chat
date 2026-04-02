import { Database } from "emoji-picker-element";
import type { NativeEmoji, EmojiSkin } from "emoji-picker-element/shared";

const emojiSet = new Set<string>();
const emojiRegex = /^\p{Extended_Pictographic}$/u;
let initializing = false;

export const emojiDatabase = new Database();

export function isSingleEmoji(text: string): boolean {
    initEmojiSet();
    return emojiSet.has(text) || emojiRegex.test(text);
}

function initEmojiSet(): void {
    if (emojiSet.size > 0 || initializing) return;
    initializing = true;

    getAllNativeEmojis()
        .then((emojis: NativeEmoji[]) => {
            emojis.forEach((e: NativeEmoji) => {
                emojiSet.add(e.unicode);
                e.skins?.forEach((s: EmojiSkin) => emojiSet.add(s.unicode));
            });
        })
        .catch((err: Error) => {
            console.error("Failed to initialize emoji database:", err);
        })
        .finally(() => (initializing = false));
}

// Initial call to start the async process
initEmojiSet();

function getAllNativeEmojis(): Promise<NativeEmoji[]> {
    return emojiDatabase.ready().then(
        () =>
            new Promise<NativeEmoji[]>((resolve, reject) => {
                const request = indexedDB.open("emoji-picker-element-en");

                request.onerror = () =>
                    reject(request.error ?? new Error("Failed to open emoji database"));

                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction("emoji", "readonly");
                    const store = transaction.objectStore("emoji");
                    const index = store.index("group-order");
                    const getAllRequest = index.getAll();

                    getAllRequest.onerror = () => {
                        db.close();
                        reject(getAllRequest.error ?? new Error("Failed to read emoji database"));
                    };

                    getAllRequest.onsuccess = () => {
                        db.close();
                        resolve(getAllRequest.result as NativeEmoji[]);
                    };
                };
            }),
    );
}
