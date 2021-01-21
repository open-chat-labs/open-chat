import React from "react";

export interface Props {
    id: string,
    blobUrl: string
}

export default React.memo(Image);

function Image(props : Props): JSX.Element {
    return <img src={props.blobUrl} />;
}
