import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Option } from "../model/common";
import sendMessage from "../actions/chats/sendMessage";
import { getSelectedChat } from "../utils/stateFunctions";
import SendButtonIcon from "../assets/icons/sendButton.svg";
import AttachFile from "./AttachFile";
import { RootState } from "../reducers";
import EmojiPicker from "./EmojiPicker";

export default React.memo(MainFooter);

function MainFooter() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    if (chat === null) {
        return <div></div>;
    }

    useEffect(() => {
        const textbox = document.getElementById("textbox");
        textbox?.addEventListener("textInput", onTextBoxTextInput, true);

        window.addEventListener("click", clearSelection, false);
    
        return () => {
            window.removeEventListener("click", clearSelection);
            textbox?.removeEventListener("textInput", onTextBoxTextInput);
        };
      }, []);    

    function onTextBoxTextInput(e: any) {
        // Markup the text so it will appear correctly in the textbox
        const text = markupNewTextForTextBox(e.data);

        // If the text hasn't been marked-up then go ahead with the text input event
        if (text == e.data)
            return;

        // Otherwise cancel it and manually insert the mark-up 
        e.preventDefault();
        document.execCommand("insertHTML", false, text);
    }

    function handleSendMessage() {
        const textbox = document.getElementById("textbox")!;
        const text = textbox.textContent;

        if (text) {
            dispatch(sendMessage(chat!, { kind: "text", text: text }));
        }

        textbox.innerHTML = "";
        textbox.focus();
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            handleSendMessage();
            e.preventDefault();
        }
    }

    // The saved textbox range selection - used to restore the selection when inserting emojis
    // from the picker
    let savedRange: Option<Range>;

    function insertTextAtCaret(text: string) {
        // Focus on the message box and re-apply any saved range selection
        restoreSelection();

        // Markup the text so it will appear correctly in the textbox and manually insert it
        document.execCommand("insertHTML", false, markupNewTextForTextBox(text));

        // Save the new selection range
        saveSelection();
    }

    function saveSelection() {
        // Save the textbox range selection so it can be restored when the textbox next gets focus
        savedRange = window.getSelection()?.getRangeAt(0) ?? null;
    }

    function clearSelection(e: MouseEvent) {
        // Clear the textbox range selection if the user clicks outside of the 
        // main footer or its descendants - the emoji picker is a descandant of
        // the main footer so clicking on it does not clear the textbox selection
        if (!(e.target instanceof Element) || 
            !e.target.matches(".enter-message, .enter-message *")) {
            savedRange = null;
        } 
    }

    function restoreSelection() {
        // Set the focus on to the textbox
        const textBox = document.getElementById("textbox")!;
        textBox.focus();

        // Set the window selection to the last saved range. If there is no existing 
        // saved range then initialise one at the end of the text box.
        if (!savedRange) {
            savedRange = new Range();
            savedRange.selectNodeContents(textBox);
            savedRange.collapse(false);
        }

        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }

    function pastePlainText(e: React.ClipboardEvent<HTMLDivElement>) {
        // Cancel the paste event
        e.preventDefault();

        // Get plain text representation of clipboard
        var text = e.clipboardData.getData('text/plain');

        // Markup the text so it will appear correctly in the textbox
        text = markupNewTextForTextBox(text);
        
        // Manually insert marked-up text
        document.execCommand("insertHTML", false, text);
    }
    
    function markupNewTextForTextBox(text: string): string {
        // If the selection is inside an "emoji span" then ensure that any initial non-emoji characters 
        // are inside their own "plain span" to split them out
        const insideEmojiSpan = isSelectionInsideEmojiSpan();

        let foundEmoji = false;
        let textForPlainSpan = "";
        let markup = "";
        for (const c of text) {
            const isEmoji = containsEmoji(c);

            if (insideEmojiSpan && !foundEmoji && isEmoji && textForPlainSpan.length > 0) {
                markup = buildPlainSpan(textForPlainSpan);
            }

            foundEmoji = foundEmoji || isEmoji;

            if (insideEmojiSpan && !foundEmoji) {
                textForPlainSpan += c;
            } else if (isEmoji) {
                markup += buildEmojiSpan(c);
            } else {
                markup += c;
            }
        }      
        
        if (insideEmojiSpan && !foundEmoji && textForPlainSpan.length > 0) {
            markup = buildPlainSpan(textForPlainSpan);
        }

        return markup;
    }

    function isSelectionInsideEmojiSpan(): boolean {
        const range = window.getSelection()?.getRangeAt(0);
        if (!range) {
            return false;
        }

        const parent = range.commonAncestorContainer as Element;
        const grandParent = parent.parentElement as Element;

        return (parent.nodeName == "SPAN" && parent.classList.contains("emoji")) 
            || (parent.nodeName == "#text" && (grandParent.nodeName == "SPAN" && grandParent.classList.contains("emoji")));
    }

    function buildEmojiSpan(c: string): string {
        return `<span class="emoji">${c}</span>`;
    }

    function buildPlainSpan(text: string): string {
        return `<span>${text}</span>`;
    }

    function containsEmoji(text: string): boolean {
        const regex_emoji = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u;
        return regex_emoji.test(text);
    }

    return (
        <footer className="enter-message">
            <div className="buttons">
                <EmojiPicker 
                    onEmojiSelected={insertTextAtCaret} 
                    onHidePicker={restoreSelection} />
                <AttachFile chat={chat} />
            </div>
            <div className="message-input-container">
                <div 
                    id="textbox" 
                    className="message-input" 
                    onPaste={pastePlainText}
                    onKeyDown={handleKeyPress}
                    onBlur={saveSelection}
                    contentEditable={true} 
                    spellCheck="true"></div>
            </div>
            <button onClick={handleSendMessage} className="send">
                <SendButtonIcon />
            </button>
        </footer>
    );
}
