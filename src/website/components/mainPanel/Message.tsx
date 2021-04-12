import React from "react";
import  { Properties } from 'csstype';
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import makeStyles from "@material-ui/styles/makeStyles";
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import gotoUser from "../../actions/chats/gotoUser";
import { Option } from "../../domain/model/common";
import { UserSummary } from "../../domain/model/users";
import { MessageContent } from "../../domain/model/messages";
import TextContent from "../shared/TextContent";
import { ChatId } from "../../domain/model/chats";
import MessageTimeAndTicks from "./MessageTimeAndTicks";
import formatFileSize from "../../formatters/fileSize";
import MessageContentComponent from "./MessageContent";
import { scaleMediaContent } from "../shared/mediaComponentFunctions";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";

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

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    message: {
        maxWidth: 500,
        padding: 3,
        borderRadius: 16,
        margin: 0,
        marginTop: 14,
        position: "relative",
        overflowWrap: "anywhere",
        overflow: "hidden",
        "&:hover .pop-over-menu-icon": {
            visibility: "visible"
        },
        "&:hover $menu": {
            opacity: "0.8",
            color: "white",
            backgroundColor: "transparent"
        }
    },    
    sentByMe: {
        alignSelf: "flex-end",
        color: theme.colors.messageSentByMe.textColor,
        backgroundColor: theme.colors.messageSentByMe.backgroundColor,
        "&$text:hover $menu": {
            color: theme.colors.messageSentByMe.textColor,
            backgroundColor: theme.colors.messageSentByMe.backgroundColor,
        },
        "&$file:hover $menu": {
            color: theme.colors.messageSentByMe.textColor
        }
    },
    sentByElse: {
        alignSelf: "flex-start",
        color: theme.colors.messageSentByElse.textColor,
        backgroundColor: theme.colors.messageSentByElse.backgroundColor,
        "& $caption, &$text:hover $menu": {
            color: theme.colors.messageSentByElse.textColor,
            backgroundColor: theme.colors.messageSentByElse.backgroundColor    
        },
        "&$file:hover $menu": {
            color: theme.colors.messageSentByElse.textColor
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
    text: {},
    file: {},
    media: {
        "& $participant": {
            position: "absolute",
            display: "block",
            padding: "4px 7px 3px 11px",
            top: 0,
            left: 0,
            zIndex: 50,
            marginLeft: 0,
            backgroundColor: "white",
            textAlign: "center",
            borderRadius: "16px 0 2px 0",
            lineHeight: "13px",
            opacity: 0.6
        }
    },
    mediaUncaptioned: {
        backgroundColor: "transparent",
        padding: 0,
        maxWidth: 494,
        "& $timeAndTicks": {
            position: "absolute",
            right: 10,
            bottom: 2    
        }
    },
    timeAndTicks: {},
    participant: {
        fontSize: 13,
        marginLeft: 6,
        fontWeight: "bolder",
        display: "block",
        textDecoration: "none",
        "&:hover": {
            textDecoration: "underline"
        }
    },
    caption: {
        overflow: "auto",
        padding: "6px 11px 4px 10px",
        color: theme.colors.messageSentByMe.textColor,
        backgroundColor: theme.colors.messageSentByMe.backgroundColor,
        borderBottomLeftRadius: "inherit",
        borderBottomRightRadius: "inherit"
    },
    textContainer: {
        padding: "3px 6px 0px 6px",
    },
    fileSize: {
        fontSize: 11,
        color: props => alpha(props.sentByMe ? theme.colors.messageSentByMe.textColor : theme.colors.messageSentByElse.textColor, 0.6)
    },
    menu: {
        position: "absolute",
        padding: 6,
        top: -5,
        right: 0,
        visibility: "hidden",
        zIndex: 3,
    }
}));

function Message(props : Props) {
    const dispatch = useDispatch();
    const classes = useStyles(props);
    const content = props.content;

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

    let text;
    let fileText;
    let containerStyle: Properties = {};
    if (content.kind === "media") {
        className += " " + classes.media;
        if (content.caption) {
            const dimensions = scaleMediaContent(content.width, content.height, true);
            containerStyle = {
                width: (dimensions.width + 6) + "px"
            };        
        } else {
            className += " " + classes.mediaUncaptioned;
        }
        text = content.caption;
    } else if (content.kind === "file") {
        className += " " + classes.file;
        fileText = content.mimeType.toUpperCase() + "-" + formatFileSize(content.size);
    } else if (content.kind === "cycles") {
        className += " " + classes.file;
        text = content.caption;
        fileText = content.caption ? null : "CYCLES TRANSFER";
    } else  {
        className += " " + classes.text;
        text = content.text;
    }

    const isMediaNoCaption = content.kind === "media" && !content.caption;

    const messageTimeAndTicks = <MessageTimeAndTicks 
        sentByMe={props.sentByMe} 
        confirmed={props.confirmed} 
        read={props.readByThem} 
        date={props.date}
        isOnMedia={isMediaNoCaption}
        className={classes.timeAndTicks} />;

    let textComponent = null;
    if (text) {
        textComponent = <TextContent text={text} variant="body1" />;
    } else if (fileText) {
        textComponent = <span className={classes.fileSize}>{fileText}</span>;
    }

    const buttons: MenuItem[] = [];
    buttons.push({ text: "Reply", action: () => {} });
    buttons.push({ text: "Forward", action: () => {} });
    buttons.push({ text: "Star", action: () => {} });
    buttons.push({ text: "Delete", action: () => {} });
    //buttons.push({ text: "Reply", action: () => dispatch(replyToMessage(chat.chatId, userId)) });
    
    return (
        <div 
            id={props.clientMessageId}
            style={containerStyle}
            data-message-id={props.messageId}
            className={className}
        >
            <PopOverMenu icon={<ExpandMoreIcon />} menuItems={buttons} placement="bottom-end" className={classes.menu + " pop-over-menu-icon"} />
            {senderLink}
            <MessageContentComponent 
                sentByMe={props.sentByMe} 
                chatId={props.chatId} 
                messageId={props.messageId}
                isGroupChat={props.isGroupChat} 
                mergeWithPrevious={mergeWithPrevious} 
                theirUsername={props.theirUsername}
                content={props.content}
                />            
            {isMediaNoCaption  ? 
            messageTimeAndTicks : 
            <div className={classes.textContainer}>
                {textComponent}
                {messageTimeAndTicks}
            </div>}            
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}