import React, {forwardRef, Ref, useImperativeHandle, useRef } from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";

type Props = {
    placeholder: string,
    onChange: (text: string) => void,
    onEnterPressed: () => void
}

const useStyles = makeStyles((theme: Theme) => ({
    inputContainer: {
        flex: "1 1 auto",
        display: "flex",
        borderRadius: 25,
        padding: "8px 15px 10px 15px",
        backgroundColor: theme.colors.textBox.backgroundColor,
        marginLeft: 6
    },
    input: {
        border: 0,
        outline: "none",
        flex: "1 1 auto",
        fontSize: 16,
        lineHeight: "20px",
        fontWeight: 400,
        color: theme.colors.textBox.textColor,
        whiteSpace: "pre-wrap",
        overflowX: "hidden",
        overflowY: "auto",
        zIndex: 1,
        minHeight: 20,
        maxHeight: 100,
        userSelect: "text",
        overflowWrap: "anywhere"
    }
}));

export interface IMessageTextInputRef {
    insertEmoji: (nativeEmoji: string) => void,
    clearText: () => void,
    onFocusAway: () => void,
    onFocusBack: () => void
}

const MessageTextInput = forwardRef((props: Props, ref: Ref<IMessageTextInputRef>) => {
    const classes = useStyles();

    // The saved textbox range selection - used to restore the selection when inserting emojis from the picker
    const savedRangeRef = useRef<Option<Range>>(null);     
    const textBoxRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({ 
        insertEmoji, 
        clearText, 
        onFocusAway, 
        onFocusBack }));    

    function insertEmoji(nativeEmoji: string) {
        // Focus on the message box and re-apply any saved range selection
        restoreSelection();

        // // Markup the text so it will appear correctly in the textbox and manually insert it
        document.execCommand("insertText", false, nativeEmoji);

        // Save the new selection range
        saveSelection();

        // Notify parent
        props.onChange(textBoxRef.current?.textContent ?? "");
    }            

    function onFocusAway() {
        clearSelection();
    }

    function onFocusBack() {
        restoreSelection();
    }

    function clearText() {
        const textBox = textBoxRef.current!;
        textBox.innerHTML = "";
        textBox.focus();
        
        props.onChange(textBoxRef.current?.textContent ?? "");
    }

    function handleInput(e: any) {
        if (e.target.innerHTML.trim() == "<br>") {
            e.target.innerHTML = "";
        }

        props.onChange(textBoxRef.current?.textContent ?? "");
    }

    function pastePlainText(e: React.ClipboardEvent<HTMLDivElement>) {
        // Cancel the paste event
        e.preventDefault();

        // Get plain text representation of clipboard
        const text = e.clipboardData.getData('text/plain');

        // Manually insert text
        document.execCommand("insertText", false, text);

        // Notify parent
        props.onChange(textBoxRef.current?.textContent ?? "");
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            props.onEnterPressed();
        }
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

    return (
        <div className={classes.inputContainer}>
        <div
            id="textbox"
            ref={textBoxRef}
            className={classes.input}
            placeholder={props.placeholder}
            onInput={handleInput}
            onPaste={pastePlainText}
            onKeyDown={handleKeyPress}
            onBlur={saveSelection}
            contentEditable={true}
            spellCheck="true"></div>
    </div>
    );
});

export default React.memo(MessageTextInput);
