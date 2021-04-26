import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { lighten } from "@material-ui/core/styles/colorManipulator";
import makeStyles from "@material-ui/styles/makeStyles";
import Dimensions from "../../utils/Dimensions";
import { Option } from "../../domain/model/common";
import { getContentAsText } from "../../domain/messageFunctions";
import { MessageContent } from "../../domain/model/messages";
import { ChatId } from "../../domain/model/chats";
import MediaContent from "./MediaContent";

export interface Props {
    content: MessageContent,
    repliesToMyMessage: boolean,
    sentByMe: boolean,
    isGroupChat: boolean,
    theirUsername: Option<string>,
    className: string,
    onClick?: () => void
}

interface StyleProps {
    sentByMe: boolean
}

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
    container: {
        cursor: "pointer",
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
        padding: "4px 8px"
    },
    text: {
        maxHeight: 71,
        minWidth: 300,
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
        borderBottomLeftRadius: 0
    }
}));

export default React.memo(MessageReplyPanel);

function MessageReplyPanel(props : Props): JSX.Element {
    let styleProps: StyleProps = {
        sentByMe: props.sentByMe
    };

    const classes = useStyles(styleProps);
    const text = getContentAsText(props.content);
    let by = props.repliesToMyMessage ? "You" : props.theirUsername ?? "Unknown";
    // if (props.chatName) {
    //     by += " - " + props.chatName;
    // }
    const className = props.className + " " + classes.container;

    let mediaContent;
    if (props.content.kind === "media") {
        let dimensions = new Dimensions(props.content.width, props.content.height);
        dimensions = dimensions.scaleToFit(new Dimensions(120, 71));
        mediaContent = <MediaContent 
            content={props.content}
            width={dimensions.width}
            height={dimensions.height}
            className={classes.mediaContent}
            ownsBlob={false} 
        /> 
    }
     
    return (
        <div className={className} onClick={props.onClick}>
            <div className={classes.textContainer}>
                <div className={classes.by}>{by}</div>
                <div className={classes.text}>{text}</div>                
            </div>
            {mediaContent}
        </div>
    );    
}