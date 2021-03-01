import React from "react";
import { makeStyles, Theme } from "@material-ui/core";

type Props = {
    text: string
}

export default React.memo(Emoji);

const useStyles = makeStyles((theme: Theme) => ({
    emoji: {
        height: 20,
        fontSize: 20,
        lineHeight: 1
    }
}));

function Emoji(props: Props) {
    const classes = useStyles();

    return <span className={classes.emoji}>{props.text}</span>;
}