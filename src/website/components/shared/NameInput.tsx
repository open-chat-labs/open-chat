import React, { useLayoutEffect, useRef, useState } from "react";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import Tick from "../../icons/tick2.svg";

export default React.memo(NameInput);

type Props = {
    className?: string,
    textBoxClassName?: string,
    onSubmit: (text: string) => void,
    placeholderText: string,
    minLength: number,
    maxLength: number,
    children?: JSX.Element[],
    disabled: boolean
}

NameInput.defaultProps = {
    minLength: 1,
    disabled: false
};

const useStyles = makeStyles((theme: Theme) => ({
    nameInput: {
        display: "flex",
        flexDirection: "column"
    },
    textBoxContainer: {
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
    const classes = useStyles();
    const textBoxRef = useRef<HTMLInputElement>(null);

    function handleSubmit() {
        if (text.length < 1) {
            return;
        }
        props.onSubmit(text);
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
        if (!props.disabled) {
            textBoxRef.current?.focus();
        }
    }, [props.disabled]);

    const className = classes.nameInput + (props.className ? " " + props.className : "");

    return (
        <div className={className}>
            <div className={classes.textBoxContainer + " " + props.textBoxClassName}>
                <input
                    className={classes.textBox}
                    ref={textBoxRef}
                    type="text"
                    value={text}
                    onChange={e => handleInputChange(e.target.value)}
                    placeholder={props.placeholderText}
                    onKeyDown={handleKeyPress}
                    minLength={props.minLength}
                    maxLength={props.maxLength}
                    disabled={props.disabled} />

                <Typography variant="body2" className={classes.charsRemaining}>{remainingCharCount}</Typography>
            </div>
            {props.children}
            <IconButton disabled={props.disabled || text.length < props.minLength} onClick={handleSubmit} className={classes.submitButton}>
                <Tick className={classes.buttonSvg} />
            </IconButton>
        </div>
    );
}