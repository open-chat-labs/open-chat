import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import Typography from "@material-ui/core/Typography";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Option } from "../../domain/model/common";
import Tick from "../../icons/tick.svg";
import DoubleTick from "../../icons/doubleTick.svg";
import { toShortTimeString } from "../../formatters/date";

export type Props = {
    sentByMe: boolean,
    confirmed: boolean,
    read: boolean,
    date: Date,
    isOnMedia: boolean,
    className: Option<string>
}

MessageTimeAndTicks.defaultProps = {
    className: null
}

export default React.memo(MessageTimeAndTicks);

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        position: "relative",
        float: "right",
        zIndex: 2,
        "&$sentByThem $tick": {
            color: alpha(theme.colors.messageSentByElse.textColor, 0.8)
        },
        "&$sentByThem $date": {
            color: alpha(theme.colors.messageSentByElse.textColor, 0.6)
        }
    },
    sentByThem: {  
        "& $date": {
            marginRight: 0
        }      
    },
    onMedia: {
        "& $date, $tick": {
            color: "white !important",    
        }
    },
    date: {
        color: alpha(theme.colors.messageSentByMe.textColor, 0.6),
        margin: "9px 15px 0 10px"
    },
    tick: {
        position: "absolute",
        right: -3,
        bottom: 0,
        color: alpha(theme.colors.messageSentByMe.textColor, 0.8),
        height: 15,
        width: 15,
        zIndex: 55
    }
}));

function MessageTimeAndTicks(props : Props) {
    const classes = useStyles();

    let tick;
    if (props.sentByMe && props.confirmed) {
        if (props.read) {
            tick = <DoubleTick className={classes.tick} />;
        } else {
            tick = <Tick className={classes.tick} />;
        }
    }

    let containerClass = classes.container;
    if (!props.sentByMe) {
        containerClass += " " + classes.sentByThem;
    }
    if (props.isOnMedia) {
        containerClass += " " + classes.onMedia;
    }
    if (props.className) {
        containerClass += " " + props.className;
    }

    return (
        <div className={containerClass}>
            <Typography className={classes.date} component="div" variant="smallest">{toShortTimeString(props.date)}</Typography>
            {tick}
        </div>
    );
}
