import React from "react";

export interface Props {
    id: string,
    data: Uint8Array,
    mimeType: string
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    const videoBlob = new Blob([props.data], { type: props.mimeType });
    const src = URL.createObjectURL(videoBlob);
    return <video controls><source src={src}/>Your browser does not support the video tag</video>;
}
