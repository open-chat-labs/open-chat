import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import { ChatId } from "../../domain/model/chats";
import { MessageContent } from "../../domain/model/messages";
import CyclesContent from "./CyclesContent";
import FileContent from "./FileContent";
import MediaContent from "./MediaContent";

export interface Props {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    sentByMe: boolean,
    isGroupChat: boolean,
    mergeWithPrevious: boolean,
    theirUsername: Option<string>,
    content: MessageContent
}
const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    container: {
        maxWidth: 494,
        backgroundColor: props => props.sentByMe 
            ? theme.colors.messageSentByMe.highlightedContentBackgroundColor 
            : theme.colors.messageSentByElse.highlightedContentBackgroundColor,
        borderRadius: props => props.isGroupChat && !props.sentByMe && props.content.kind !== "media"
            ? 6
            : `${props.mergeWithPrevious && !props.sentByMe ? "2" : "13"}px ${props.mergeWithPrevious && props.sentByMe ? "2" : "13"}px 6px 6px`
    },
    mediaNoCaption: {
        position: "relative",
        borderRadius: "inherit"
    }
}));

export default React.memo(MessageContentComponent);

function MessageContentComponent(props : Props): JSX.Element {
    const classes = useStyles(props);
    const content = props.content;

    const isMediaNoCaption = content.kind === "media" && !content.caption;

    let contentElement = null;
    if (content.kind === "media") {
        contentElement = <MediaContent chatId={props.chatId} messageId={props.messageId} content={content} />;
    } else if (content.kind === "file") {
        contentElement = <FileContent content={content} sentByMe={props.sentByMe} />;
    } else if (content.kind === "cycles") {
        contentElement = <CyclesContent content={content} sentByMe={props.sentByMe} theirUsername={props.theirUsername} />;
    }

    return (
        <div className={isMediaNoCaption ? classes.mediaNoCaption : classes.container}>
            {contentElement}
        </div>
    );    
}