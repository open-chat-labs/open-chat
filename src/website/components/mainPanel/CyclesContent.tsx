import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Typography from "@material-ui/core/Typography";
import { formatCycles } from "../../formatters/cycles";
import { Option } from "../../domain/model/common";
import { CyclesContent as Cycles } from "../../domain/model/messages";

export default React.memo(CyclesContent);

export interface Props {
    content: Cycles,
    sentByMe: boolean,
    theirUsername: Option<string>
}

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    cycles: {
        padding: "0 12px",
        display: "flex",
        alignItems: "center"
    },
    icon: {
        fontSize: 50,
        marginRight: 12
    }
}));

function CyclesContent(props : Props): JSX.Element {
    const classes = useStyles(props);
    return (
        <div className={classes.cycles}>    
            <Typography className={classes.icon}>💸</Typography>
            <Typography variant="body1">{formatCycles(props.content.amount)} {props.sentByMe ? "sent to" : "received from"} {props.theirUsername ?? "unknown"}</Typography>
        </div>
    );
}
