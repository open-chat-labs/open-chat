import React from "react";
import ReactDOMServer from 'react-dom/server';
import { Typography, TypographyVariant } from "@material-ui/core";
import { containsEmoji } from "../utils/emojiFunctions";
import Emoji from "./Emoji";

export default React.memo(TextContent);

export interface Props {
    text: string,
    variant: TypographyVariant,
    insertLineBreaks?: boolean
}

function TextContent(props : Props): JSX.Element {
    function markupText(text: string, linebreaks: boolean): string {
        // Wrap contiguous emoji chars in an "emoji span"
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
                    markup += ReactDOMServer.renderToStaticMarkup(<Emoji text={emojis} />);
                    emojis = "";
                }
                markup += c;
            }
        }

        if (emojis.length) {
            markup += ReactDOMServer.renderToStaticMarkup(<Emoji text={emojis} />);
        }

        if (linebreaks) {
            // Replace newlines with <br> tags
            markup = markup.replace(/(?:\r\n|\r|\n)/g, '<br>');
        }

        return markup
    }

    const markup = markupText(
        props.text, 
        props.insertLineBreaks !== undefined ? props.insertLineBreaks : true);

    return (
        <Typography variant={props.variant} dangerouslySetInnerHTML={{ __html: markup }} />
    );
}
