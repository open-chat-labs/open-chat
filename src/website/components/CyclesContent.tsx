import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import { formatCycles } from "../formatters/cycles";
import { Option } from "../domain/model/common";
import { CyclesContent as Cycles } from "../domain/model/messages";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles,
    sentByMe: boolean,
    theirUsername: Option<string>
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    cycles: {
        padding: "4px 12px",
        borderRadius: 8,
        backgroundColor: props => props.sentByMe 
            ? theme.colors.messageSentByMe.highlightedContentBackgroundColor 
            : theme.colors.messageSentByElse.highlightedContentBackgroundColor,
        marginBottom: 3
    }
}));

function CyclesContent(props : Props): JSX.Element {
    const classes = useStyles(props);
    return (
        <>
            <Typography variant="body1" component="div" className={classes.cycles}>{formatCycles(props.content.amount)} {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</Typography>
            {props.content.caption}
        </>
    );
}
