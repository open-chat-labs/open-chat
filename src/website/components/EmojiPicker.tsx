import React from "react";
import { EmojiData, Picker } from 'emoji-mart'
import Smiley from "../assets/icons/smiley.svg";

export default React.memo(EmojiPicker);

type Props = {
    onEmojiSelected: (text: string) => void,
    onHidePicker: () => void,
}

function EmojiPicker(props: Props) {
    return (
        <>
            <div className="smiley button hide-on-click-ignore" onClick={toggleEmojiPicker}>
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
            props.onEmojiSelected(emojiData.native);
        }
    }

    function toggleEmojiPicker() {
        const elemClassList = document.getElementById("emojisContainer")!.classList;
        elemClassList.toggle("hide");
        if (elemClassList.contains("hide")) {
            props.onHidePicker();
        } else {
            focusOnEmojiSearch();
        }
    }

    function focusOnEmojiSearch() {
        document.getElementById("emoji-mart-search-1")?.focus();
    }
}

