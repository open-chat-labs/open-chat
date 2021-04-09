import React, { useEffect } from "react";
import * as CSS from 'csstype';
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

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        borderRadius: "inherit",
        position: "relative",
    },
    uncaptioned: {
        "& $shade": {
            position: "absolute",
            bottom: 0,
            zIndex: 2,
            width: "100%",
            height: 28,
            background: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0.3))",
            borderBottomLeftRadius: "inherit",
            borderBottomRightRadius: "inherit"    
        },
        "& $media": {
            borderRadius: "inherit"
        }
    },
    media: {
        borderTopLeftRadius: "inherit",
        borderTopRightRadius: "inherit",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0
    },
    shade: {}
}));

function MediaContent(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const classes = useStyles();
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
    const containerStyle: CSS.Properties = {
        width: dimensions.width + "px",
        height: dimensions.height + "px"
    };

    let containerClass = classes.container;
    if (!content.caption) {
        containerClass += " " + classes.uncaptioned;
    }

    let contentElement;
    if (content.mimeType.startsWith("image/") || !content.blobUrl) {
        contentElement = <Image key={props.content.id} src={src} width={dimensions.width} height={dimensions.height} className={classes.media} />;
    } else if (content.mimeType.startsWith("video/")) {
        contentElement = <Video key={props.content.id} src={src} width={dimensions.width} height={dimensions.height} className={classes.media} />;
    }

    return (
        <>
            <div className={containerClass} style={containerStyle}>
                {contentElement}
                <div className={classes.shade}></div>
            </div>
        </>
    );
}