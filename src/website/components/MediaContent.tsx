import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Option } from "../domain/model/common";
import { ChatId } from "../domain/model/chats";
import getMedia from "../actions/chats/getMessageMedia";
import { MediaContent as Media } from "../domain/model/messages";
import Image from "./Image";
import Video from "./Video";
import { makeStyles, Theme } from "@material-ui/core";

export interface Props {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    content: Media
}

export default React.memo(MediaContent);

const useStyles = makeStyles((theme: Theme) => ({
    media: {
        borderRadius: "inherit"
    }
}));

function MediaContent(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const classes = useStyles();
    const content = props.content;

    useEffect(() => {
        if (!content.data && props.chatId && props.messageId) {
            dispatch(getMedia(
                props.chatId, 
                props.messageId, 
                content.id, 
                content.size, 
                content.chunkSize));
        }            
      }, []);    

    const src = content.data ? content.data : content.thumbnailData;

    let contentElement;
    if (content.mimeType.startsWith("image/") || !content.data) {
        contentElement = <Image key={props.content.id} src={src} width={props.content.width} height={props.content.height} className={classes.media} />;
    } else if (content.mimeType.startsWith("video/")) {
        contentElement = <Video key={props.content.id} src={src} width={props.content.width} height={props.content.height} className={classes.media} />
    }

    return (
        <>
            {contentElement}
        </>
    );
}