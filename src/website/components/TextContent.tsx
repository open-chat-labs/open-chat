import React from "react";
import { buildEmojiSpan, containsEmoji } from "../model/messages";

export default React.memo(TextContent);

export interface Props {
    text: string
}

function TextContent(props : Props): JSX.Element {

    // Wrap contiguous emoji chars in an "emoji span"
    function markupEmojis(text: string): string {
        let markup = "";
        let emojis = "";
        for (const c of text) {
            const isEmoji = containsEmoji(c);
            // If the char is an emoji or a zero-width joiner &zwj;
            // then accumulate the chars in a string to be wrapped in an "emoji span"
            if (isEmoji || c == '\u200D') {
                emojis += c;
            } else {
                if (emojis.length) {
                    markup += buildEmojiSpan(emojis);
                    emojis = "";
                }
                markup += c;
            }
        }

        if (emojis.length) {
            markup += buildEmojiSpan(emojis);
        }

        return markup;
    }

    return (
        <span dangerouslySetInnerHTML={{ __html: markupEmojis(props.text) }}></span>
    );
}
