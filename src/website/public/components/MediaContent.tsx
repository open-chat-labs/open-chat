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
    const [data, isDataDownloading] = useSelector(
        (state: RootState) => getBlobState(state, props.content), 
        (a, b) => a[0] === b[0] && a[1] === b[1]);

    let contentElement;
    const content = props.content;

    if (data) {
        if (content.mimeType.startsWith("image/")) {
            contentElement = <Image id={props.content.blobId} data={data} />;
        } else if (content.mimeType.startsWith("video/")) {
            contentElement = <Video id={props.content.blobId} data={data} mimeType={props.content.mimeType} />
        }
    } else if (!isDataDownloading) {
        dispatch(getData(content.blobId, content.blobSize, content.chunkSize));
        contentElement = "Loading...";
    }

    return (
        <>
            {contentElement}
        </>
    );
}

function getBlobState(state: RootState, content: Media): [Option<Uint8Array>, boolean] {
    const blobsState = state.blobsState;
    return [
        blobsState.blobs.hasOwnProperty(content.blobId) ? blobsState.blobs[content.blobId] as Uint8Array : null,
        blobsState.blobsDownloading.includes(content.blobId)
    ];
}