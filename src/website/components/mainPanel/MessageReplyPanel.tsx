import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { lighten } from "@material-ui/core/styles/colorManipulator";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import { getContentAsText } from "../../domain/messageFunctions";
import { MessageContent } from "../../domain/model/messages";
import { ChatId } from "../../domain/model/chats";

export interface Props {
    chatId: ChatId,
    messageId: number,
    content: MessageContent,
    repliesToMyMessage: boolean,
    sentByMe: boolean,
    isGroupChat: boolean,
    theirUsername: Option<string>,
    className: string,
    onClick?: () => void
}

interface StyleProps {
    sentByMe: boolean,
    thumbnailSrc?: string    
}

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
    container: {
        cursor: "pointer",
        overflow: "hidden",
        padding: "4px 8px",
        borderLeftColor: props => lighten(theme.colors.green.main, props.sentByMe ? 0.4 : 0.0),
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        fontSize: 14,
        backgroundRepeat: "no-repeat",
        backgroundPositionX: "right",
        backgroundSize: "contain",
        backgroundImage: props => props.thumbnailSrc
    },
    text: {
        maxHeight: 63,
        minWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
        wordWrap: "break-word",
        whiteSpace: "pre-wrap",
        display: "-webkit-box",
        "-webkit-line-clamp": 3,
        "-webkit-box-orient": "vertical"
    },
    by: {
        color: props => lighten(theme.colors.green.main, props.sentByMe ? 0.4 : 0.0)
    }
}));

export default React.memo(MessageReplyPanel);

function MessageReplyPanel(props : Props): JSX.Element {
    let styleProps: StyleProps = {
        sentByMe: props.sentByMe
    };

    if (props.content.kind === "media") {
        console.log(props.content.thumbnailData);
        styleProps.thumbnailSrc = `url(${props.content.thumbnailData})`;
    }

    const classes = useStyles(styleProps);
    const text = getContentAsText(props.content);
    let by = props.repliesToMyMessage ? "You" : props.theirUsername ?? "Unknown";
    // if (props.chatName) {
    //     by += " - " + props.chatName;
    // }
    const className = props.className + " " + classes.container;
     
    return (
        <div className={className} onClick={props.onClick}>
            <div className={classes.by}>{by}</div>
            <div className={classes.text}>{text}</div>                
        </div>
    );    
}