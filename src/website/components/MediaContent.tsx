import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Option } from "../model/common";
import getData from "../actions/data/getData";
import { MediaContent as Media } from "../model/messages";
import { RootState } from "../reducers";
import Image from "./Image";
import Video from "./Video";

export interface Props {
    content: Media
}

export default React.memo(MediaContent);

function MediaContent(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const [blobUrl, isDataDownloading] = useSelector(
        (state: RootState) => getBlobState(state, props.content), 
        (a, b) => a[0] === b[0] && a[1] === b[1]);

    let contentElement;
    const content = props.content;

    if (blobUrl) {
        if (content.mimeType.startsWith("image/")) {
            contentElement = <Image key={props.content.id} blobUrl={blobUrl} />;
        } else if (content.mimeType.startsWith("video/")) {
            contentElement = <Video key={props.content.id} blobUrl={blobUrl} />
        }
    } else if (!isDataDownloading) {
        setTimeout(() => dispatch(getData(
            content.id,
            content.mimeType,
            content.size, 
            content.chunkSize,
            true)), 0);
        contentElement = "Loading...";
    }

    return (
        <>
            {contentElement}
        </>
    );
}

function getBlobState(state: RootState, content: Media): [Option<string>, boolean] {
    const blobsState = state.blobsState;
    return [
        blobsState.blobs.hasOwnProperty(content.id) ? blobsState.blobs[content.id] as string : null,
        blobsState.blobsDownloading.includes(content.id)
    ];
}