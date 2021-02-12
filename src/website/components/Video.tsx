import React from "react";
import { scaleMediaContent } from "./mediaComponentFunctions";

export interface Props {
    blobUrl: string
    width: number,
    height: number
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    const dimensions = scaleMediaContent(props.width, props.height);
    return <video 
        className="message-media" 
        controls
        width={dimensions.width}
        height={dimensions.height}>
        <source src={props.blobUrl}/>Your browser does not support the video tag
    </video>;
}
