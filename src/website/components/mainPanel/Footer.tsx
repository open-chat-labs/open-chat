import React, {useEffect, useRef, useState} from "react";
import { useDispatch, useSelector } from "react-redux";
import IconButton from "@material-ui/core/IconButton";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import SendButtonIcon from "@material-ui/icons/Send";
import makeStyles from "@material-ui/styles/makeStyles";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import { Option } from "../../domain/model/common";
import * as chatFunctions from "../../domain/model/chats";
import sendMessage from "../../actions/chats/sendMessage";
import { getSelectedChat, getUserSummary } from "../../domain/stateFunctions";
import AttachFile from "../AttachFile";
import { RootState } from "../../reducers";
import SendCycles, { ISendCyclesRef } from "../SendCycles";
import CurrentUserTypingHandler from "../../domain/CurrentUserTypingHandler";
import Smiley from "../../assets/icons/smiley.svg";
import Dollar from "../../assets/icons/dollar.svg";
import EmojiPicker from "../EmojiPicker"
import CloseButton from "../CloseButton";

export default React.memo(Footer);

const useStyles = makeStyles((theme: Theme) => ({
    footer: {
        display: "flex",
        backgroundColor: theme.colors.footer.backgroundColor,
        flexDirection: "column"
    },
    container: {
        color: "#9b9b9b",
        padding: "11px 16px 11px 10px",
        display: "flex",
        alignItems: "center"
    },
    inputContainer: {
        flex: "1 1 auto",
        display: "flex",
        borderRadius: 25,
        padding: "8px 15px 10px 15px",
        backgroundColor: theme.colors.textBox.backgroundColor,
        marginLeft: 6
    },
    buttons: {
        display: "flex"
    },
    button: {
        borderRadius: "50%",
        padding: 4,
        marginRight: 6,
        cursor: "pointer",
        "&:hover,:focus": {
            backgroundColor: "#e0e0e0"
        },
        "& svg": {
            verticalAlign: "middle",
            pointerEvents: "none",
            margin: 0,
            padding: 0,
            color: theme.colors.footer.iconColor
        }
    },
    input: {
        border: 0,
        outline: "none",
        flex: "1 1 auto",
        fontSize: 18,
        lineHeight: "20px",
        fontWeight: 300,
        color: theme.colors.textBox.textColor,
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
    },
    dollarButton: {
        width: 32
    },
    paperclipButton: {
        marginLeft: 4
    }
}));

enum MessagePanelState {
    Closed,
    EmojiPicker,
    SendCycles,
    SendMedia,
    SendFile
}

function Footer() {
    const dispatch = useDispatch();
    const [messagePanelState, setMessagePanel] = useState(MessagePanelState.Closed);
    const chat = useSelector((state: RootState) => getSelectedChat(state.chatsState));

    const them = useSelector((state: RootState) => chat != null && chatFunctions.isDirectChat(chat) 
        ? getUserSummary(chat.them, state.usersState.userDictionary)
        : null);

    if (chat === null) {
        return <div></div>;
    }

    const sendCyclesRef = useRef<ISendCyclesRef>(null);

    // The saved textbox range selection - used to restore the selection when inserting emojis from the picker
    const savedRangeRef = useRef<Option<Range>>(null);     

    useEffect(() => {
        if (messagePanelState == MessagePanelState.Closed) {
            restoreSelection();
        }
    }, [messagePanelState]);

    function handleInput(e: any) {
        if (e.target.innerHTML.trim() == "<br>") {
            e.target.innerHTML = "";
        }

        if (chat && chatFunctions.isConfirmedChat(chat)) {
            CurrentUserTypingHandler.markTyping(chat.chatId);
        }
    }

    const textBoxRef = useRef<HTMLDivElement>(null);

    function handleSendMessage() {
        const textBox = textBoxRef.current!;
        const text = textBox.textContent;

        let sent = false;
        switch (messagePanelState) {
            case MessagePanelState.SendCycles:
                if (sendCyclesRef.current) {
                    sent = sendCyclesRef.current.sendCycles(text);
                }
                break;
            default:
                if (text) {
                    dispatch(sendMessage(chat!, { kind: "text", text: text }, null));
                    sent = true;
                }
                break;
        }    

        if (sent) {
            const textBox = textBoxRef.current!;
            textBox.innerHTML = "";
            textBox.focus();
        }
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            handleSendMessage();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function insertEmojiAtCaret(text: string) {
        // Focus on the message box and re-apply any saved range selection
        restoreSelection();

        // // Markup the text so it will appear correctly in the textbox and manually insert it
        // document.execCommand("insertHTML", false, ReactDOMServer.renderToStaticMarkup(<Emoji text={text} />));
        document.execCommand("insertText", false, text);

        // Save the new selection range
        saveSelection();
    }

    function handleClickAway() {
        clearSelection();
    }

    function saveSelection() {
        // Save the textbox range selection so it can be restored when the textbox next gets focus
        savedRangeRef.current = window.getSelection()?.getRangeAt(0) ?? null;
    }

    function restoreSelection() {
        // Set the focus on to the textbox
        const textBox = textBoxRef.current!;
        textBox.focus();

        // Set the window selection to the last saved range. If there is no existing 
        // saved range then initialise one at the end of the text box.
        if (!savedRangeRef.current) {
            const range = new Range();
            range.selectNodeContents(textBox);
            range.collapse(false);
            savedRangeRef.current = range;
        }

        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
    }

    function clearSelection() {
        savedRangeRef.current = null;
    }

    function pastePlainText(e: React.ClipboardEvent<HTMLDivElement>) {
        // Cancel the paste event
        e.preventDefault();

        // Get plain text representation of clipboard
        var text = e.clipboardData.getData('text/plain');

        // Manually insert text
        document.execCommand("insertText", false, text);
    }

    const classes = useStyles();

    let messagePanel = null;

    switch (messagePanelState) {
        case MessagePanelState.EmojiPicker:
            messagePanel = <EmojiPicker 
                onEmojiSelected={insertEmojiAtCaret}/>;
            break;
        case MessagePanelState.SendCycles:
            if (chatFunctions.isDirectChat(chat)) {
                messagePanel = <SendCycles 
                    ref={sendCyclesRef}
                    chat={chat}
                    recipient={them!} 
                    onSend={() => setMessagePanel(MessagePanelState.Closed)} />
            }
            break;
    }

    const closeButton = <CloseButton  
        onClick={() => setMessagePanel(MessagePanelState.Closed)}
        className={classes.button} />;

    return (
        <ClickAwayListener onClickAway={handleClickAway}>            
            <footer className={classes.footer}>
                {messagePanel}
                <div className={classes.container}>
                    <div className={classes.buttons}>
                        {messagePanelState != MessagePanelState.EmojiPicker ?
                        <IconButton 
                            onClick={_ => setMessagePanel(MessagePanelState.EmojiPicker)} 
                            className={classes.button}>
                            <Smiley />
                        </IconButton> : closeButton}
                        <AttachFile 
                            chat={chat}
                            buttonClassName={classes.button + " " + classes.paperclipButton} />
                        {them && messagePanelState != MessagePanelState.SendCycles ? 
                        <IconButton 
                            className={classes.button + " " + classes.dollarButton} 
                            onClick={_ => setMessagePanel(MessagePanelState.SendCycles)}>
                            <Dollar />
                        </IconButton> : (them ? closeButton : null)}
                    </div>
                    <div className={classes.inputContainer}>
                        <div
                            id="textbox"
                            ref={textBoxRef}
                            className={classes.input}
                            placeholder="Type a message"
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
                </div>
            </footer>
        </ClickAwayListener>        
    );
}
