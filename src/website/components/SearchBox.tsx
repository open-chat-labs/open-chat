import React from "react";
import SearchIcon from "../assets/icons/search.svg";
import { makeStyles, Theme } from "@material-ui/core";

export default React.memo(SearchBox);

type Props = {
    id: string,
    text: string,
    onChange: (text: string) => void,
    defaultPlaceholderText: string,
}

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        backgroundColor: "#f6f6f6",
        padding: "6px 15px",
        position: "relative"
    },
    textBox: {
        backgroundColor: "white",
        width: "100%",
        border: 0,
        borderRadius: 25,
        padding: "4px 15px 6px 64px",
        fontSize: 15,
        fontWeight: 300,
        outline: "none",
        color: "#111111"
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
                id={props.id}
                className={classes.textBox}
                value={props.text}
                onChange={e => props.onChange(e.target.value)}
                placeholder={props.defaultPlaceholderText} />
            <SearchIcon className={classes.icon} />
        </div>
    );
}