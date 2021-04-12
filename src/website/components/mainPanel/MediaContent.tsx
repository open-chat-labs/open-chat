import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { Option } from "../../domain/model/common";
import { ChatId } from "../../domain/model/chats";
import { scaleMediaContent } from "../shared/mediaComponentFunctions";
import getMedia from "../../actions/chats/getMessageMedia";
import { MediaContent as Media } from "../../domain/model/messages";
import Image from "../shared/Image";
import Video from "../shared/Video";

export interface Props {
    chatId: Option<ChatId>,
    messageId: Option<number>,
    content: Media
}

export default React.memo(MediaContent);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    media: {
        borderRadius: "inherit"
    },
    noCaption: {
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

function MediaContent(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const classes = useStyles(props);
    const content = props.content;

    useEffect(() => {
        if (!content.blobUrl && props.chatId && props.messageId) {
            dispatch(getMedia(
                props.chatId, 
                props.messageId, 
                content.id, 
                content.size, 
                content.chunkSize));
        }            
      }, []);  
      
    const src = content.blobUrl ? content.blobUrl : content.thumbnailData;
    const dimensions = scaleMediaContent(props.content.width, props.content.height, true);

    let contentElement;
    if (content.mimeType.startsWith("image/") || !content.blobUrl) {
        contentElement = <Image key={props.content.id} src={src} width={dimensions.width} height={dimensions.height} className={classes.media} />;
    } else if (content.mimeType.startsWith("video/")) {
        contentElement = <Video key={props.content.id} src={src} width={dimensions.width} height={dimensions.height} className={classes.media} />;
    }

    const shadow = content.caption ? null : <div className={classes.shadow}></div>;

    return (
        <>
            {contentElement}
            {shadow}
        </>
    );
}