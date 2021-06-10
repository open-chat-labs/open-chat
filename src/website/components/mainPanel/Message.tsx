import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { alpha, darken } from "@material-ui/core/styles/colorManipulator";
import makeStyles from "@material-ui/styles/makeStyles";
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import gotoUser from "../../actions/chats/gotoUser";
import { gotoChatById } from "../../actions/chats/gotoChat";
import deselectMessage from "../../actions/chats/deselectMessage";
import { Option } from "../../domain/model/common";
import { UserId, UserSummary } from "../../domain/model/users";
import { MessageContent, ReplyContext } from "../../domain/model/messages";
import TextContent from "../shared/TextContent";
import MediaContent from "./MediaContent";
import { ChatId } from "../../domain/model/chats";
import MessageTimeAndTicks from "./MessageTimeAndTicks";
import formatFileSize from "../../formatters/fileSize";
import PopOverMenu, { MenuItem } from "../shared/PopOverMenu";
import { selectReplyPrivatelyToMessage, selectReplyToMessage } from "../../actions/chats/replyToMessage";
import MessageReplyPanel from "./MessageReplyPanel";
import FileContent from "./FileContent";
import CyclesContent from "./CyclesContent";

export type Props = {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    userId: UserId,
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
    readByThem: boolean,
    repliesToContent: Option<MessageContent>,
    repliesToChatId: Option<ChatId>,
    repliesToMessageId: Option<number>,
    repliesToMyMessage: boolean,
    repliesToUsername: Option<string>,
    selectEffect: boolean
}

type StyleProps = {
    sentByMe: boolean,
    contentBorderRadius: string,
    selectEffect: boolean
}

export default React.memo(Message);

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
    message: {
        maxWidth: 500,
        [theme.breakpoints.down('sm')]: {
            maxWidth: "87vw"
        },
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
        },
    },    
    sentByMe: {
        alignSelf: "flex-end",
        color: theme.colors.messageSentByMe.textColor,
        backgroundColor: props => darken(theme.colors.messageSentByMe.backgroundColor, props.selectEffect ? 0.3 : 0),
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
        backgroundColor: props => darken(theme.colors.messageSentByElse.backgroundColor, props.selectEffect ? 0.3 : 0),
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
        minWidth: 330,
        [theme.breakpoints.down('sm')]: {
            minWidth: "60vw"
        },
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
        backgroundColor: "transparent !important",
        padding: 0,
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
    },
    contentContainer: {
        backgroundColor: props => props.sentByMe 
            ? theme.colors.messageSentByMe.highlightedContentBackgroundColor 
            : theme.colors.messageSentByElse.highlightedContentBackgroundColor
    },    
    mediaNoCaption: {
        position: "relative",
        borderRadius: "inherit"
    },
    topPanel: {
        borderRadius: props => props.contentBorderRadius
    },
    secondPanel: {
        borderRadius: 6,
        marginTop: 3
    },
    mediaContent: {
        borderRadius: "inherit"
    },
    shadow: {
        position: "absolute",
        bottom: 0,
        zIndex: 2,
        width: "100%",
        minWidth: 330,
        height: 28,
        background: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0.3))",
        borderBottomLeftRadius: "inherit",
        borderBottomRightRadius: "inherit"
    }    
}));

function Message(props : Props) {
    const dispatch = useDispatch();
    const content = props.content;

    useEffect(() => {
        if (props.selectEffect && props.chatId) {
            const chatId = props.chatId;
            setTimeout(() => {
                dispatch(deselectMessage(chatId));
            }, 1000);
        }
    }, [props.selectEffect]);

    // Based on the position of this message within a "group" of messages derive these properties to be used in styling
    const mergeWithNext = props.groupPosition === MessageGroupPosition.Top || props.groupPosition === MessageGroupPosition.Middle;
    const mergeWithPrevious = props.groupPosition === MessageGroupPosition.Middle || props.groupPosition === MessageGroupPosition.Bottom;

    // Calculate the border radius of the top-most message panel
    let borderRadius = [6, 6, 6, 6];
    if (!props.isGroupChat || props.sentByMe || content.kind === "media") {
        borderRadius[0] = mergeWithPrevious && !props.sentByMe ? 2 : 13;
        borderRadius[1] = mergeWithPrevious && props.sentByMe ? 2 : 13;
    }
    const borderRadiusStr = borderRadius.map(e => e + "px").join(" ");

    // Pass some props into useStyles to configure the JSS
    const styleProps = {
        sentByMe: props.sentByMe,
        contentBorderRadius: borderRadiusStr,
        selectEffect: props.selectEffect
    };
    const classes = useStyles(styleProps);

    // Build up the combination of css classes applied to the container based on various factors
    let className = `${classes.message} ${(props.sentByMe ? classes.sentByMe : classes.sentByElse)}`;
    if (!props.readByMe) {
        className += " unread " + classes.unread;
    }
    if (mergeWithNext) {
        className += " " + classes.mergeWithNext;
    }
    if (mergeWithPrevious) {
        className += " " + classes.mergeWithPrevious;
    }

    // Is this message just standalone media
    const isMediaNoCaption = content.kind === "media" && !content.caption && !props.repliesToContent;

    // Dynamically build the child components that comprise the message
    const children: JSX.Element[] = [];
    {
        // 1. Add the drop down menu
        const buttons: MenuItem[] = [];
        // if (props.sentByMe) {
        //     buttons.push({ text: "Info", action: () => {} });
        // }
        if (props.confirmed && props.chatId && props.messageId) {
            const replyContext: ReplyContext = {
                chatId: props.chatId,
                messageId: props.messageId,
                content: props.content,
                userId: props.userId
            };

            buttons.push({ text: "Reply", action: () => dispatch(selectReplyToMessage(replyContext)) });
            if (props.sender) {
                const sender = props.sender;
                buttons.push({ text: "Reply privately", action: () => dispatch(selectReplyPrivatelyToMessage(replyContext, sender)) });
            }
            // buttons.push({ text: "Forward", action: () => {} });
            // buttons.push({ text: "Star", action: () => {} });
        }
        // buttons.push({ text: "Delete", action: () => {} });
        children.push(
            <PopOverMenu 
                key="menu"
                icon={<ExpandMoreIcon />} 
                menuItems={buttons} 
                placement="bottom-end" 
                className={classes.menu + " pop-over-menu-icon"} />
        );

        // 2. Conditionally add the sender link 
        if (props.sender && (props.groupPosition == MessageGroupPosition.None || props.groupPosition == MessageGroupPosition.Top)) {
            const sender = props.sender;
            children.push(
                <a 
                    key="sender"
                    className={classes.participant}
                    href="#" 
                    role="button" 
                    title={`Select chat with "${sender.username}"`}
                    onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>
            );
        }

        // 3. Conditionally add the reply to message panel
        if (props.repliesToContent) {
            const className = classes.contentContainer + " " + classes.topPanel;
            children.push(
                <MessageReplyPanel
                    key="replyPanel"
                    repliesToChatId={props.repliesToChatId!}
                    isPrivateReply={props.chatId !== props.repliesToChatId}
                    content={props.repliesToContent}
                    repliesToMyMessage={props.repliesToMyMessage}
                    sentByMe={props.sentByMe}
                    isGroupChat={props.isGroupChat}
                    theirUsername={props.theirUsername}
                    repliesToUsername={props.repliesToUsername}
                    className={className}
                    onClick={() => dispatch(gotoChatById(props.repliesToChatId!, props.repliesToMessageId!))}
                />            
            );
        }

        // 4. Add any message type specific content
        {            
            let contentComponent;
            let shadow;
            switch (content.kind) {
                case "file": 
                    contentComponent = <FileContent 
                        content={content} 
                        sentByMe={props.sentByMe} />; 
                    break;
                case "cycles": 
                    contentComponent = <CyclesContent 
                        content={content} 
                        sentByMe={props.sentByMe} 
                        theirUsername={props.theirUsername} />; 
                    break;
                case "media": 
                    contentComponent = <MediaContent 
                        content={content} 
                        ownsBlob={true} 
                        className={classes.mediaContent} />; 
                    // Add a shadow effect to bottom of media so the "time and ticks" can be seen
                    if (!content.caption) {
                        shadow = <div key="shadow" className={classes.shadow}></div>;
                    }
                    break;
            }
            if (contentComponent) {
                const className = classes.contentContainer + " " + (props.repliesToContent ? classes.secondPanel : classes.topPanel);
                children.push(
                    <div key="content" className={isMediaNoCaption ? classes.mediaNoCaption : className}>
                        {contentComponent}
                    </div>
                );

                if (shadow) {
                    children.push(shadow);
                }
            }
        }

        // 5. If this message is standalone media then render "time and ticks" directly otherwise wrap the text + "time and ticks" together
        {
            const messageTimeAndTicks = <MessageTimeAndTicks 
                key="timeAndTicks"
                sentByMe={props.sentByMe} 
                confirmed={props.confirmed} 
                read={props.readByThem} 
                date={props.date}
                isOnMedia={isMediaNoCaption}
                className={classes.timeAndTicks} />;
    
            if (isMediaNoCaption) {
                children.push(messageTimeAndTicks);
            } else {
                // 6. Build the text component
                let text;
                let fileText;
                switch (content.kind) {
                    case "media": 
                        text = content.caption; 
                        break;
                    case "file": 
                        fileText = content.mimeType.toUpperCase() + "-" + formatFileSize(content.size); 
                        break;
                    case "cycles": 
                        text = content.caption;
                        fileText = content.caption ? null : "CYCLES TRANSFER";
                        break;
                    default:
                        text = content.text;
                        break;
                }
                        
                let textComponent = null;
                if (text) {
                    textComponent = <TextContent text={text} variant="body1" plainText={false} sentByMe={props.sentByMe} />;
                } else if (fileText) {
                    textComponent = <span className={classes.fileSize}>{fileText}</span>;
                }
                            
                children.push(
                    <div key="text" className={classes.textContainer}>
                        {textComponent}
                        {messageTimeAndTicks}
                    </div>
                );
            }
        }
    }

    // Build the class and style of the container
    switch (content.kind) {
        case "media":
            className += " " + classes.media;
            if (!content.caption) {
                className += " " + classes.mediaUncaptioned;
            }
            break;
        case "file":
        case "cycles": 
            className += " " + classes.file;
            break;
        default:
            className += " " + classes.text;
            break;
    }

    return (
        <div 
            id={props.clientMessageId}
            data-message-id={props.messageId}
            className={className}
        >
            {children}
        </div>
    );
}

export enum MessageGroupPosition {
    None,
    Top,
    Middle,
    Bottom
}
