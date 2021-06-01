import React from "react";
import { useSelector } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { lighten } from "@material-ui/core/styles/colorManipulator";
import makeStyles from "@material-ui/styles/makeStyles";
import Photo from "@material-ui/icons/Photo";
import Attachment from "@material-ui/icons/Attachment";
import { RootState } from "../../reducers";
import { getChatSubject } from "../../domain/stateFunctions";
import { Option } from "../../domain/model/common";
import { ChatId } from "../../domain/model/chats";
import { getContentAsText } from "../../domain/messageFunctions";
import { MessageContent } from "../../domain/model/messages";
import MediaContent from "./MediaContent";
import { formatCyclesText } from "./CyclesContent";

export interface Props {
    content: MessageContent,
    repliesToMyMessage: boolean,
    repliesToChatId: ChatId,
    repliesToUsername: Option<string>,
    isPrivateReply: boolean,
    sentByMe: boolean,
    isGroupChat: boolean,
    theirUsername: Option<string>,
    className: string,
    onClick?: () => void
}

interface StyleProps {
    sentByMe: boolean,
    showPointer: boolean
}

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
    container: {
        cursor: props => props.showPointer ? "pointer" : "default",
        overflow: "hidden",
        borderLeftColor: props => lighten(theme.colors.green.main, props.sentByMe ? 0.4 : 0.0),
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        fontSize: 14,
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between"
    },
    textContainer: {
        padding: "4px 8px",
        minWidth: 120
    },
    text: {
        maxHeight: 72,
        overflow: "hidden",
        textOverflow: "ellipsis",
        wordWrap: "break-word",
        whiteSpace: "pre-wrap",
        display: "-webkit-box",
        "-webkit-line-clamp": 2,
        "-webkit-box-orient": "vertical"
    },
    by: {
        color: props => lighten(theme.colors.green.main, props.sentByMe ? 0.4 : 0.0)
    },
    mediaContent: {
        borderTopRightRadius: "inherit",
        borderBottomRightRadius: "inherit",
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        maxWidth: 120,
        maxHeight: 72,
        height: "auto",
        width: "auto"        
    },
    cyclesIcon: {
        marginLeft: 12,
        marginRight: 12,
        fontSize: 50
    },
    icon: {
        verticalAlign: "top",
        display: "inline-block",
        width: 20,
        height: 20,
        marginRight: 3
    }
}));

export default React.memo(MessageReplyPanel);

function MessageReplyPanel(props : Props): JSX.Element {
    let styleProps: StyleProps = {
        sentByMe: props.sentByMe,
        showPointer: props.onClick != undefined
    };

    let chatSubject;
    if (props.isPrivateReply) {
        chatSubject = useSelector((state: RootState) => getChatSubject(state.chatsState, props.repliesToChatId));
    }

    const classes = useStyles(styleProps);
    let text = getContentAsText(props.content);
    let by = props.repliesToMyMessage ? "You" : props.repliesToUsername ?? "Unknown";
    if (chatSubject) {
        by += " - " + chatSubject;
    }
    const className = props.className + " " + classes.container;

    let rightContent;
    let icon;
    if (props.content.kind === "media") {
        rightContent = <MediaContent 
            content={props.content}
            className={classes.mediaContent}
            ownsBlob={false} 
        />;
        icon = <Photo className={classes.icon} />;
    } else if (props.content.kind === "cycles") {
        rightContent = <div className={classes.cyclesIcon}>🎉</div>;
        text = formatCyclesText(props.content.amount, props.repliesToMyMessage, props.theirUsername);
    } else if (props.content.kind === "file") {
        icon = <Attachment className={classes.icon} />;
    }
     
    return (
        <div className={className} onClick={props.onClick}>
            <div className={classes.textContainer}>
                <div className={classes.by}>{by}</div>
                <div className={classes.text}>{icon}{text}</div>                
            </div>
            {rightContent}
        </div>
    );    
}