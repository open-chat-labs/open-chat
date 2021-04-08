import React from "react";
import { alpha } from "@material-ui/core/styles/colorManipulator";
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
    isGroupChat: boolean,
    mergeWithPrevious: boolean,
    theirUsername: Option<string>
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    cycles: {
        padding: "0 12px",
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
        fontSize: 50,
        marginRight: 12
    },
    caption: {
        marginLeft: 6
    },
    noCaption: {
        marginLeft: 6,
        fontSize: 11,
        color: props => alpha(props.sentByMe ? theme.colors.messageSentByMe.textColor : theme.colors.messageSentByElse.textColor, 0.6)
    }
}));

function CyclesContent(props : Props): JSX.Element {
    const classes = useStyles(props);
    return (
        <>
            <div className={classes.cycles}>    
                <Typography className={classes.icon}>💸</Typography>
                <Typography variant="body1">{formatCycles(props.content.amount)} {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</Typography>
            </div>
            <Typography className={props.content.caption ? classes.caption : classes.noCaption} variant="body2">{props.content.caption ?? "CYCLES TRANSFER"}</Typography>
        </>
    );
}
