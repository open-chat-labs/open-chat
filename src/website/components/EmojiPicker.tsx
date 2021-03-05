import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { EmojiData, Picker } from 'emoji-mart'

export default React.memo(EmojiPicker);

type Props = {
    onEmojiSelected: (text: string) => void
}

const useStyles = makeStyles((theme: Theme) => ({
    "@global": {
        ".emoji-mart": {
            backgroundColor: "#f0f0f0",
            border: 0,
            borderRadius: 0
        },
        ".emoji-mart-search": {
            paddingBottom: 6
        },
        ".emoji-mart-search input": {
            paddingTop: 7,
            backgroundColor: "#e0e0e0"
        },
        ".emoji-mart-category-label span": {
            backgroundColor: "#f0f0f0",
            opacity: 0.9,
            color: "#444444"
        },
        ".emoji-mart-scroll": {
            height: 215
        }
    }
}));

function EmojiPicker(props: Props) {

    useStyles();

    return (
        <Picker
            title={"Pick your emoji..."}
            theme="light"
            color="#d62c7d"
            onSelect={onSelectEmoji}
            autoFocus={true}
            showPreview={false}
            showSkinTones={false}
            emojiTooltip={true}
            emoji="point_up"
            emojiSize={28}
            perLine={3}
            native={true} 
            style={{
                width: "100%"
            }}/>
    );

    function onSelectEmoji(emojiData: EmojiData) {
        if ("native" in emojiData) {
            props.onEmojiSelected(emojiData.native);
        }
    }
}

