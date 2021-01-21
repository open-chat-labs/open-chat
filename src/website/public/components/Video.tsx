import React from "react";

export interface Props {
    id: string,
    blobUrl: string
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    return <video controls><source src={props.blobUrl}/>Your browser does not support the video tag</video>;
}
