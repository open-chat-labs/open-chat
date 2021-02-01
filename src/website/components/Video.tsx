import React from "react";

export interface Props {
    blobUrl: string
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    return <video className="message-media" controls><source src={props.blobUrl}/>Your browser does not support the video tag</video>;
}
