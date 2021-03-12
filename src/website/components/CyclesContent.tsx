import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import Dollar from "../assets/icons/dollar.svg";
import { formatCycles } from "../formatters/cycles";
import { Option } from "../domain/model/common";
import { CyclesContent as Cycles } from "../domain/model/messages";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles,
    sentByMe: boolean,
    isGroupChat: boolean,
    mergeWithPrevious: boolean,
    theirUsername: Option<string>
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    cycles: {
        padding: "4px 12px",
        backgroundColor: props => props.sentByMe 
            ? theme.colors.messageSentByMe.highlightedContentBackgroundColor 
            : theme.colors.messageSentByElse.highlightedContentBackgroundColor,
        display: "flex",
        alignItems: "center",
        borderRadius: props => props.isGroupChat && !props.sentByMe
            ? 6
            : `${props.mergeWithPrevious && !props.sentByMe ? "2" : "13"}px ${props.mergeWithPrevious && props.sentByMe ? "2" : "13"}px 6px 6px`,
        marginBottom: 3
    },
    icon: {
        width: 48,
        height: 48
    },
    caption: {
        marginLeft: 6
    }
}));

function CyclesContent(props : Props): JSX.Element {
    const classes = useStyles(props);
    return (
        <>
            <div className={classes.cycles}>
                <Dollar className={classes.icon} />
                <Typography variant="body1">{formatCycles(props.content.amount)} {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</Typography>
            </div>
            <Typography className={classes.caption} variant="body1">{props.content.caption}</Typography>            
        </>
    );
}
