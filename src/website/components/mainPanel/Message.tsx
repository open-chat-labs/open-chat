import React from "react";
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import gotoUser from "../../actions/chats/gotoUser";
import { Option } from "../../domain/model/common";
import { UserSummary } from "../../domain/model/users";
import { MessageContent } from "../../domain/model/messages";
import { scaleMediaContent } from "../shared/mediaComponentFunctions";
import CyclesContent from "./CyclesContent";
import FileContent from "./FileContent";
import MediaContent from "./MediaContent";
import TextContent from "../shared/TextContent";
import { ChatId } from "../../domain/model/chats";
import MessageTimeAndTicks from "./MessageTimeAndTicks";

export type Props = {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    clientMessageId: string,
    content: MessageContent,
    date: Date,
    isGroupChat: boolean,
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
        color: theme.colors.messageSentByMe.textColor,
        backgroundColor: theme.colors.messageSentByMe.backgroundColor
    },
    sentByElse: {
        alignSelf: "flex-start",
        color: theme.colors.messageSentByElse.textColor,
        backgroundColor: theme.colors.messageSentByElse.backgroundColor,
        "& $caption": {
            color: theme.colors.messageSentByElse.textColor,
            backgroundColor: theme.colors.messageSentByElse.backgroundColor    
        }
    },
    unread: {
        filter: `brightness(${theme.colors.messageSentByElse.unreadMessageBrightness})`
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
        minWidth: 330,
        padding: 3,
        "& $participant": {
            marginLeft: 8
        },
        "& $timeAndTicks": {
            marginRight: 8
        }
    },
    media: {
        padding: 0,
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
        }
    },
    mediaUncaptioned: {
        "& $timeAndTicks": {
            position: "absolute",
            right: 10,
            bottom: 2    
        }
    },
    timeAndTicks: {

    },
    participant: {
        fontSize: 13,
        fontWeight: "bolder",
        display: "block",
        textDecoration: "none",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    caption: {
        overflow: "auto",
        padding: "6px 11px 4px 11px",
        color: theme.colors.messageSentByMe.textColor,
        backgroundColor: theme.colors.messageSentByMe.backgroundColor,
        borderBottomLeftRadius: "inherit",
        borderBottomRightRadius: "inherit"
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
            onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
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
    let caption;
    if (props.content.kind === "media") {
        className += " " + classes.media;
        if (props.content.caption) {
            caption = props.content.caption;
        } else {
            className += " " + classes.mediaUncaptioned;
        }
        contentElement = <MediaContent chatId={props.chatId} messageId={props.messageId} content={props.content} />;
    } else if (props.content.kind === "file") {
        contentElement = <FileContent content={props.content} sentByMe={props.sentByMe} isGroupChat={props.isGroupChat} mergeWithPrevious={mergeWithPrevious} />;
        className += " " + classes.file;
    } else if (props.content.kind === "cycles") {
        contentElement = <CyclesContent content={props.content} sentByMe={props.sentByMe} isGroupChat={props.isGroupChat} mergeWithPrevious={mergeWithPrevious} theirUsername={props.theirUsername} />;
        className += " " + classes.file;
    } else {
        contentElement = <TextContent text={props.content.text} variant="body1" />;
    }

    const messageTimeAndTicks = <MessageTimeAndTicks 
        sentByMe={props.sentByMe} 
        confirmed={props.confirmed} 
        read={props.readByThem} 
        date={props.date}
        isOnMedia={props.content.kind === "media" && !caption}
        className={classes.timeAndTicks} />;

    let bottom;
    if (caption) {
        let mediaCaptionStyle;
        if (props.content.kind === "media") {
            const dimensions = scaleMediaContent(props.content.width, props.content.height, true);
            mediaCaptionStyle = {
                width: dimensions.width + "px"
            }
        };
    
        bottom = <div className={classes.caption} style={mediaCaptionStyle}>
            <TextContent text={caption} variant="body2" />
            {messageTimeAndTicks}
        </div>;
    } else {
        bottom = messageTimeAndTicks;
    }

    return (
        <div 
            id={props.clientMessageId}
            data-message-id={props.messageId}
            className={className}>
            {senderLink}
            {contentElement}
            {bottom}
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}