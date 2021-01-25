import React from "react";

export interface Props {
    blobUrl: string
}

export default React.memo(Image);

function Image(props : Props): JSX.Element {
    return <img className="message-media" src={props.blobUrl} />;
}
