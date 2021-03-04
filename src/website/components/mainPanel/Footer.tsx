import React, { useEffect } from "react";
import ReactDOMServer from 'react-dom/server';
import { useDispatch, useSelector } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import * as chatFunctions from "../../domain/model/chats";
import sendMessage from "../../actions/chats/sendMessage";
import { getSelectedChat, getUserSummary } from "../../domain/stateFunctions";
import SendButtonIcon from "../../assets/icons/sendButton.svg";
import AttachFile from "../AttachFile";
import { RootState } from "../../reducers";
import EmojiPicker from "../EmojiPicker";
import { containsEmoji } from "../../utils/emojiFunctions";
import SendCycles from "../SendCycles";
import CurrentUserTypingHandler from "../../domain/CurrentUserTypingHandler";
import Emoji from "../Emoji";

export default React.memo(Footer);

const useStyles = makeStyles((theme: Theme) => ({
    footer: {
        display: "flex",
        padding: "11px 16px",
        color: "#9b9b9b",
        backgroundColor: "#f0f0f0",
        alignItems: "center"
    },
    container: {
        flex: "1 1 auto",
        display: "flex",
        borderRadius: 25,
        padding: "8px 15px 10px 15px",
        backgroundColor: "white"
    },
    buttons: {
        display: "flex"
    },
    button: {
        borderRadius: "50%",
        padding: 4,
        cursor: "pointer",
        "&:hover,:focus": {
            backgroundColor: "#e0e0e0"
        },
        "& svg": {
            verticalAlign: "middle",
            pointerEvents: "none",
            margin: 0,
            padding: 0,
            color: "#9b9b9b"
        }
    },
    input: {
        border: 0,
        outline: "none",
        flex: "1 1 auto",
        fontSize: 15,
        lineHeight: "20px",
        fontWeight: 400,
        color: "#111111",
        whiteSpace: "pre-wrap",
        overflowX: "hidden",
        overflowY: "auto",
        zIndex: 1,
        minHeight: 20,
        maxHeight: 100,
        userSelect: "text",
        overflowWrap: "anywhere"
    },
    sendButton: {
        outline: 0,
        height: 25,
        border: 0,
        margin: 0,
        padding: 0,
        cursor: "pointer",
        alignSelf: "center",
        backgroundColor: "transparent",
        marginLeft: 20,
        color: "#9b9b9b"
    }
}));

function Footer() {
    const dispatch = useDispatch();
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    const them = useSelector((state: RootState) => chat != null && chatFunctions.isDirectChat(chat) 
        ? getUserSummary(chat.them, state.usersState.userDictionary)
        : null);

    if (chat === null) {
        return <div></div>;
    }

    useEffect(() => {
        window.addEventListener("click", onWindowClick, false);
    
        return () => window.removeEventListener("click", onWindowClick);
      }, []);    

    function handleBeforeInput(e: any) {
        // Markup the text so it will appear correctly in the textbox
        const text = markupNewTextForTextBox(e.data);

        // If the text hasn't been marked-up then go ahead with the text input event
        if (text == e.data)
            return;

        // Otherwise cancel it and manually insert the mark-up 
        e.preventDefault();
        document.execCommand("insertHTML", false, text);
    }

    function handleInput(e: any) {
        if (e.target.innerHTML.trim() == "<br>") {
            e.target.innerHTML = "";
        }

        if (chat && chatFunctions.isConfirmedChat(chat)) {
            CurrentUserTypingHandler.markTyping(chat.chatId);
        }
    }

    function handleSendMessage() {
        const textbox = document.getElementById("textbox")!;
        const text = textbox.textContent;

        if (text) {
            dispatch(sendMessage(chat!, { kind: "text", text: text }, null));
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

    function insertEmojiAtCaret(text: string) {
        // Focus on the message box and re-apply any saved range selection
        restoreSelection();

        // Markup the text so it will appear correctly in the textbox and manually insert it
        document.execCommand("insertHTML", false, ReactDOMServer.renderToStaticMarkup(<Emoji text={text} />));

        // Save the new selection range
        saveSelection();
    }

    function saveSelection() {
        // Save the textbox range selection so it can be restored when the textbox next gets focus
        savedRange = window.getSelection()?.getRangeAt(0) ?? null;
    }

    function onWindowClick(e: MouseEvent) {
        // Clear the textbox range selection if the user clicks outside of the main footer or its 
        // descendants - the emoji picker is a descandant of the main footer so clicking on it does 
        // not clear the textbox selection
        if (!(e.target instanceof Element) || !e.target.matches(".enter-message, .enter-message *")) {
            clearSelection();
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

    function clearSelection() {
        savedRange = null;
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
                markup += ReactDOMServer.renderToStaticMarkup(<Emoji text={c} />);
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

    function buildPlainSpan(text: string): string {
        return `<span>${text}</span>`;
    }

    const classes = useStyles();

    return (
        <footer className={classes.footer}>
            <div className={classes.buttons}>
                <EmojiPicker
                    onEmojiSelected={insertEmojiAtCaret}
                    onHidePicker={restoreSelection}
                    buttonClassName={classes.button} />
                <AttachFile 
                    chat={chat}
                    buttonClassName={classes.button} />
                {them ? <SendCycles 
                    chat={chat}
                    recipient={them} 
                    onHidePicker={restoreSelection}
                    buttonClassName={classes.button} /> : null}
            </div>
            <div className={classes.container}>
                <div
                    id="textbox"
                    className={classes.input}
                    placeholder="Type a message"
                    onBeforeInput={handleBeforeInput}
                    onInput={handleInput}
                    onPaste={pastePlainText}
                    onKeyDown={handleKeyPress}
                    onBlur={saveSelection}
                    contentEditable={true}
                    spellCheck="true"></div>
            </div>
            <button onClick={handleSendMessage} className={classes.sendButton}>
                <SendButtonIcon />
            </button>
        </footer>
    );
}
