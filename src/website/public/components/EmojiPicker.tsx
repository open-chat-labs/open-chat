import React from "react";
import { EmojiData, Picker } from 'emoji-mart'
import Smiley from "../assets/icons/smiley.svg";

export default React.memo(EmojiPicker);

type Props = {
    appendNewMessageText: (text: string) => void,
    focusOnTextInput: () => void,
}

function EmojiPicker(props: Props) {
    return (
        <>
            <div className="smiley button hide-on-click-ignore" onClick={_ => toggleEmojiPicker()}>
                <Smiley />
            </div>
            <div id="emojisContainer" className="emojis-container hide-on-click-outside hide">
                <Picker 
                    title={"Pick your emoji..."}
                    theme="light"
                    onSelect={onSelectEmoji}
                    emoji="point_up" 
                    native={true} />
            </div>
        </>
    );

    function onSelectEmoji(emojiData: EmojiData) {
        if ("native" in emojiData) {
            props.appendNewMessageText(emojiData.native + " ");
            props.focusOnTextInput();
        }
    }

    function toggleEmojiPicker() {
        const elemClassList = document.getElementById("emojisContainer")!.classList;
        elemClassList.toggle("hide");
        if (elemClassList.contains("hide")) {
            props.focusOnTextInput();
        } else {
            focusOnEmojiSearch();
        }
    }

    function focusOnEmojiSearch() {
        document.getElementById("emoji-mart-search-1")?.focus();
    }
}

