import React from "react";
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import { getContentAsText } from "../../domain/messageFunctions";
import { MessageContent } from "../../domain/model/messages";
import { ChatId } from "../../domain/model/chats";
import { gotoChatById } from "../../actions/chats/gotoChat";
import CyclesContent from "./CyclesContent";
import FileContent from "./FileContent";
import MediaContent from "./MediaContent";

export interface Props {
    chatId: ChatId,
    messageId: number,
    content: MessageContent,
    sentByMe: boolean,
    isGroupChat: boolean,
    mergeWithPrevious: boolean,
    theirUsername: Option<string>
}
const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    container: {
        cursor: "pointer"
    }
}));

export default React.memo(MessageReplyPanel);

function MessageReplyPanel(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const classes = useStyles(props);
    const text = getContentAsText(props.content);
    const by = props.sentByMe ? "You" : props.theirUsername;

    return (
        <div className={classes.container} onClick={() => dispatch(gotoChatById(props.chatId, props.messageId))}>
            REPLY: {text}<br/>
            BY: {by}
        </div>
    );    
}