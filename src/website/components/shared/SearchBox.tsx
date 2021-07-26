import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import SearchIcon from "../../icons/search.svg";

export default React.memo(SearchBox);

type Props = {
    text: string,
    onChange: (text: string) => void,
    placeholderText: string,
    ref?: React.RefObject<HTMLInputElement>
}

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        backgroundColor: theme.colors.sidePanel.subHeaderBackgroundColor,
        padding: "6px 15px",
        position: "relative"
    },
    textBox: {
        width: "100%",
        border: 0,
        borderRadius: 25,
        padding: "4px 15px 6px 64px",
        fontSize: 15,
        fontWeight: 300,
        outline: "none",
        color: theme.colors.textBox.textColor,
        backgroundColor: theme.colors.textBox.backgroundColor
    },
    icon: {
        display: "block",
        float: "left",
        position: "absolute",
        top: 11,
        left: 25,
        color: "#aaaaaa"
    }
}));

function SearchBox(props: Props) {
    const classes = useStyles();

    return (
        <div className={classes.container}>
            <input
                className={classes.textBox}
                ref={props.ref}
                maxLength={25}
                value={props.text}
                onChange={e => props.onChange(e.target.value)}
                placeholder={props.placeholderText} />
            <SearchIcon className={classes.icon} />
        </div>
    );
}