import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import he from "he";
import ReactDOMServer from 'react-dom/server';
import Typography from "@material-ui/core/Typography";
import { Variant as TypographyVariant } from "@material-ui/core/styles/createTypography";
import { containsEmoji } from "../../utils/emojiFunctions";
import { wrapURLsInAnchorTags } from "../../utils/urlFunctions";
import Emoji from "./Emoji";

export default React.memo(TextContent);

export interface Props {
    text: string,
    variant: TypographyVariant,
    plainText: boolean,
    sentByMe?: boolean
}

const useStyles = makeStyles<Theme>((theme: Theme) => ({
    sentByMe: {
        "& a": {
            color: "inherit"
        }
    }
}))

function TextContent(props : Props): JSX.Element {
    const classes = useStyles();

    function markupText(text: string, plainText: boolean): string {
        // First HTML encode the text
        text = he.encode(text);

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

        if (!plainText) {
            // Try to wrap links in <a> tags
            markup = wrapURLsInAnchorTags(markup, true);

            // Replace newlines with <br> tags
            markup = markup.replace(/(?:\r\n|\r|\n)/g, '<br>');
        }

        return markup
    }

    const markup = markupText(props.text, props.plainText);
    const className = props.sentByMe ? classes.sentByMe : undefined;

    return (
        <Typography className={className} variant={props.variant} dangerouslySetInnerHTML={{ __html: markup }} />
    );
}
