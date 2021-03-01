export function containsEmoji(text: string): boolean {
    const regex_emoji = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u;
    return regex_emoji.test(text);
}
