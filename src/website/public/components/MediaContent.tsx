import React from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { Option } from "../model/common";
import getData from "../actions/data/getData";
import { MediaContent as Media } from "../model/messages";
import { RootState } from "../reducers";

export interface Props {
    content: Media
}

export default MediaContent;

function MediaContent(props : Props): JSX.Element {
    const dispatch = useDispatch();
    const [data, isDataDownloading] = useSelector(
        (state: RootState) => getBlobState(state, props.content), 
        (a, b) => a[0] === b[0] && a[1] === b[1]);

    let contentElement;
    const content = props.content;

    if (data) {
        if (content.mimeType.startsWith("image/")) {
            const src = "data:*/*;base64," + btoa(data.reduce((data, byte) => data + String.fromCharCode(byte), ''));
            contentElement = <img src={src} />;
        } else if (content.mimeType.startsWith("video/")) {
            const videoBlob = new Blob([data], { type: 'video/mp4', });
            const src = URL.createObjectURL(videoBlob);
            contentElement = <video controls><source src={src}/>Your browser does not support the video tag</video>;
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