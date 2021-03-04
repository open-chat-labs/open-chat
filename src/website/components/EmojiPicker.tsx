import React, {useRef, useState} from "react";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Popper from "@material-ui/core/Popper";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { EmojiData, Picker } from 'emoji-mart'
import Smiley from "../assets/icons/smiley.svg";

export default React.memo(EmojiPicker);

type Props = {
    onEmojiSelected: (text: string) => void,
    onHidePicker: () => void,
    buttonClassName: string
}

const useStyles = makeStyles((theme: Theme) => ({
    smileyButton: {
        marginRight: 10
    },
    emojisContainer: {
        zIndex: 100
    }
}));

function EmojiPicker(props: Props) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLElement>(null);
    const classes = useStyles();

    const popperModifiers = [
        {
          name: 'offset',
          options: {
                offset: [-11, 18],
            },
        },
    ];

    return (
        <>
            <IconButton className={props.buttonClassName + " " + classes.smileyButton} buttonRef={anchorRef} onClick={toggleEmojiPicker}>
                <Smiley />
            </IconButton>
            <Popper id="emojisContainer" open={open} anchorEl={anchorRef.current} modifiers={popperModifiers} placement="top-start" className={classes.emojisContainer}>
                <ClickAwayListener onClickAway={toggleEmojiPicker}>
                    <Paper>
                        <Picker
                            title={"Pick your emoji..."}
                            theme="light"
                            onSelect={onSelectEmoji}
                            emoji="point_up"
                            native={true} />
                    </Paper>
                </ClickAwayListener>
            </Popper>
        </>
    );

    function onSelectEmoji(emojiData: EmojiData) {
        if ("native" in emojiData) {
            props.onEmojiSelected(emojiData.native);
        }
    }

    function toggleEmojiPicker() {
        if (open) {
            setOpen(false);
            props.onHidePicker();
        } else {
            setOpen(true);
            focusOnEmojiSearch();
        }
    }

    function focusOnEmojiSearch() {
        document.getElementById("emoji-mart-search-1")?.focus();
    }
}

