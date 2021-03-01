import React, { useLayoutEffect, useState } from "react";
import Tick from "../assets/icons/tick2.svg";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(NameInput);

type Props = {
    onSubmit: (text: string) => void,
    defaultPlaceholderText: string,
    maxLength: number
}

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        marginTop: 60,
        display: "flex",
        flexDirection: "column"
    },
    textBoxContainer: {
        marginLeft: 30,
        paddingBottom: 4,
        borderBottom: "2px solid #3dc5ee",
        display: "flex",
        justifyContent: "space-between"
    },
    textBox: {
        border: 0,
        padding: 0,
        outline: "none",
        flexGrow: 1
    },
    charsRemaining: {
        marginRight: 12,
        color: "#cccccc"
    },
    submitButton: {
        alignSelf: "center",
        marginTop: 40,
        width: 46,
        height: 46,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#32cd32",
        boxShadow: "0 1px 3px rgba(80,80,80,0.4)",
        "&:hover": {
            backgroundColor: alpha("#32cd32", 0.8)
        }
    },
    buttonSvg: {
        color: "white",
        verticalAlign: "middle",
        pointerEvents: "none"
    }
}));

function NameInput(props: Props) {
    const [text, setText] = useState("");
    const remainingCharCount = props.maxLength - text.length;
    const clearInput = () => setText("");
    const classes = useStyles();

    function handleSubmit() {
        if (text.length < 1) {
            return;
        }
        props.onSubmit(text);
        clearInput();
    }

    function handleInputChange(text: string) {
        setText(text);
    }

    function handleKeyPress(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === "Enter") {
            handleSubmit();
            e.preventDefault();
        }
    }

    useLayoutEffect(() => {
        document.getElementById("nameInput")?.focus();
    }, []);    

    return (
        <div className={classes.nameInput}>
            <div className={classes.textBoxContainer}>
                <input
                    id="nameInput"
                    className={classes.textBox}
                    type="text"
                    value={text}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={props.defaultPlaceholderText}
                    onKeyDown={handleKeyPress}
                    maxLength={props.maxLength} />

                <Typography variant="body2" className={classes.charsRemaining}>{remainingCharCount}</Typography>
            </div>
            {text.length > 0
                ? <IconButton onClick={_ => handleSubmit()} className={classes.submitButton}>
                    <Tick className={classes.buttonSvg} />
                </IconButton>
                : null}
        </div>
    );
}