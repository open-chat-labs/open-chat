import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

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