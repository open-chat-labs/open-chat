import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { toShortTime } from "../utils/datetimeFunctions";
import gotoUser from "../actions/chats/gotoUser";
import getData from "../actions/data/getData";
import { UserSummary } from "../model/users";
import { MessageContent } from "../model/messages";
import { RootState } from "../reducers";

export interface Props {
    content: MessageContent,
    date?: Date,
    sentByMe: boolean,
    sender?: UserSummary,
    mergeWithPrevious: boolean
}

export default Message;

function Message(props : Props) {
    const dispatch = useDispatch();
    const blobsState = useSelector((state: RootState) => state.blobsState);

    let className = "message " + (props.sentByMe ? "me" : "them");
    let senderLink = null;
    if (props.mergeWithPrevious) {
        className += " merge";
    } else if (props.sender) {
        const sender = props.sender;
        senderLink = <a className="participant" href="#" onClick={_ => dispatch(gotoUser(sender))}>{sender.username}</a>;
    }
    let contentElement;
    const content = props.content;
    if (content.kind === "text") {
        contentElement = content.text;
    } else {
        if (blobsState.blobs.hasOwnProperty(content.blobId)) {
            const data = blobsState.blobs[content.blobId];
            const src = "data:*/*;base64," + btoa(String.fromCharCode(...data));
            contentElement = <img src={src} />;
        } else if (!blobsState.blobsDownloading.includes(content.blobId)) {
            dispatch(getData(content.blobId, content.blobSize, content.chunkSize));
            contentElement = "Loading...";
        }
    }

    return (
        <p className={className}>
            {senderLink}
            {contentElement}
            <span className="message-time">{props.date ? toShortTime(props.date) : "..."}</span>
        </p>
    );
}
