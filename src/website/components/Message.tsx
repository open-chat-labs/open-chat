import React, { CSSProperties } from "react";
import { useDispatch } from "react-redux";
import Typography from "@material-ui/core/Typography";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import gotoUser from "../actions/chats/gotoUser";
import Tick from "../assets/icons/tick.svg";
import DoubleTick from "../assets/icons/doubleTick.svg";
import { Option } from "../domain/model/common";
import { UserSummary } from "../domain/model/users";
import { MessageContent } from "../domain/model/messages";
import CyclesContent from "./CyclesContent";
import FileContent from "./FileContent";
import MediaContent from "./MediaContent";
import TextContent from "./TextContent";
import { toShortTimeString } from "../formatters/date";
import { styleMediaMessage } from "./mediaComponentFunctions";
import { ChatId } from "../domain/model/chats";

export type Props = {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    clientMessageId: string,
    content: MessageContent,
    date: Date,
    sentByMe: boolean,
    sender: Option<UserSummary>,
    theirUsername: Option<string>,
    groupPosition: MessageGroupPosition,
    confirmed: boolean,
    readByMe: boolean,
    readByThem: boolean
}

export default React.memo(Message);

const useStyles = makeStyles((theme: Theme) => ({
    message: {
        maxWidth: 500,
        padding: "6px 11px 4px 11px",
        borderRadius: 16,
        margin: 0,
        marginTop: 14,
        position: "relative",
        overflowWrap: "anywhere"
    },
    sentByMe: {
        alignSelf: "flex-end",
        color: theme.customColors.messageSentByMe.color,
        backgroundColor: theme.customColors.messageSentByMe.backgroundColor,
        "& $time": {
            color: alpha(theme.customColors.messageSentByMe.color, 0.6)
        },
        "&$file $time": {
            marginRight: 19
        }
    },
    sentByElse: {
        alignSelf: "flex-start",
        color: theme.customColors.messageSentByElse.color,
        backgroundColor: theme.customColors.messageSentByElse.backgroundColor,
        "& $time": {
            marginRight: 0,
            color: alpha(theme.customColors.messageSentByElse.color, 0.6)
        },
        "&$media $time": {
            right: 12
        },
        "&$file $time": {
            marginRight: 9
        }
    },
    unread: {
        backgroundColor: alpha(theme.customColors.messageSentByElse.backgroundColor, 0.8)
    },
    mergeWithNext: {
        "&$sentByMe": {
            borderBottomRightRadius: 4
        },
        "&$sentByElse": {
            borderBottomLeftRadius: 4
        }
    },
    mergeWithPrevious: {
        marginTop: 2,
        "&$sentByMe": {
            borderTopRightRadius: 4
        },
        "&$sentByElse": {
            borderTopLeftRadius: 4
        }
    },
    file: {
        padding: 3,
        "& $participant": {
            marginLeft: 8
        },
        "& $time": {
            marginTop: 6,
            marginBottom: 3
        }
    },
    media: {
        padding: 0,
        position: "relative",
        backgroundColor: "transparent",
        "& $participant": {
            position: "absolute",
            display: "block",
            padding: "4px 7px 3px 11px",
            top: 0,
            left: 0,
            zIndex: 50,
            backgroundColor: "white",
            textAlign: "center",
            borderRadius: "16px 0 2px 0",
            lineHeight: "13px",
            opacity: 0.6
        },
        "& $time": {
            position: "absolute",
            display: "inline",
            float: "none",
            margin: 0,
            right: 24,
            bottom: 4,
            backgroundColor: "rgba(68, 68, 68, 0.6)",
            color: "#dddddd",
            textAlign: "center",
            borderRadius: 6,
            padding: "0 4px"
        },
        "& $tick": {
            bottom: 4,
            right: 3
        }
    },
    participant: {
        fontSize: 13,
        fontWeight: "bolder",
        display: "block",
        textDecoration: "none",
        color: "#d62c7d",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    time: {
        display: "block",
        float: "right",
        margin: "10px 12px 0 10px",
        textAlign: "right"
    },
    tick: {
        color: alpha(theme.customColors.messageSentByMe.color, 0.8),
        position: "absolute",
        height: 15,
        width: 15,
        bottom: 4,
        right: 4,
        zIndex: 55
    }
}));

function Message(props : Props) {
    const dispatch = useDispatch();
    const classes = useStyles();

    let className = `${classes.message} ${(props.sentByMe ? classes.sentByMe : classes.sentByElse)}`;
    let senderLink = null;

    if (props.sender && (props.groupPosition == MessageGroupPosition.None || props.groupPosition == MessageGroupPosition.Top)) {
        const sender = props.sender;
        senderLink = <a 
            className={classes.participant}
            href="#" 
            role="button" 
            title={`Select chat with "${sender.username}"`}
            onClick={_ => dispatch(gotoUser(sender.userId, sender.username))}>{sender.username}</a>;
    }

    if (!props.readByMe) {
        className += " unread " + classes.unread;
    }

    const mergeWithNext = props.groupPosition === MessageGroupPosition.Top || props.groupPosition === MessageGroupPosition.Middle;
    const mergeWithPrevious = props.groupPosition === MessageGroupPosition.Middle || props.groupPosition === MessageGroupPosition.Bottom;
    if (mergeWithNext) {
        className += " " + classes.mergeWithNext;
    }
    if (mergeWithPrevious) {
        className += " " + classes.mergeWithPrevious;
    }

    let contentElement;
    let style: CSSProperties | undefined;
    if (props.content.kind === "media") {
        className += " " + classes.media;
        contentElement = <MediaContent chatId={props.chatId} messageId={props.messageId} content={props.content} />;
        style = styleMediaMessage(props.content.width, props.content.height);
    } else if (props.content.kind === "file") {
        contentElement = <FileContent content={props.content} sentByMe={props.sentByMe} mergeWithPrevious={mergeWithPrevious} />;
        className += " " + classes.file;
    } else if (props.content.kind === "cycles") {
        contentElement = <CyclesContent content={props.content} sentByMe={props.sentByMe} theirUsername={props.theirUsername} />;
    } else {
        contentElement = <TextContent text={props.content.text} variant="body1" />
    }

    let tick: Option<JSX.Element> = null;
    if (props.sentByMe && props.confirmed) {
        if (props.readByThem) {
            tick = <DoubleTick className={classes.tick} />;
        } else {
            tick = <Tick className={classes.tick} />;
        }
    }

    return (
        <div 
            id={props.clientMessageId}
            data-message-id={props.messageId}
            className={className}
            style={style}>
            {senderLink}
            {contentElement}
            <Typography variant="smallest" className={classes.time}>{toShortTimeString(props.date)}</Typography>
            {tick}
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}