import React, { useLayoutEffect, useState } from "react";
import Tick from "../assets/icons/tick2.svg";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(NameInput);

type Props = {
    className?: string,
    onSubmit: (text: string) => void,
    defaultPlaceholderText: string,
    minLength: number,
    maxLength: number
}

NameInput.defaultProps = {
    minLength: 1
};

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
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
        },
        "&:disabled": {
            visibility: "hidden"
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

    const className = classes.nameInput + (props.className ? " " + props.className : "");

    return (
        <div className={className}>
            <div className={classes.textBoxContainer}>
                <input
                    id="nameInput"
                    className={classes.textBox}
                    type="text"
                    value={text}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={props.defaultPlaceholderText}
                    onKeyDown={handleKeyPress}
                    minLength={props.minLength}
                    maxLength={props.maxLength} />

                <Typography variant="body2" className={classes.charsRemaining}>{remainingCharCount}</Typography>
            </div>
            <IconButton disabled={text.length < props.minLength} onClick={_ => handleSubmit()} className={classes.submitButton}>
                <Tick className={classes.buttonSvg} />
            </IconButton>
        </div>
    );
}