import React from "react";
import { scaleMediaContent } from "./mediaComponentFunctions";

export interface Props {
    src: string,
    width: number,
    height: number,
    className: string
}

export default React.memo(Image);

function Image(props : Props): JSX.Element {
    const dimensions = scaleMediaContent(props.width, props.height);
    return <img
        className={props.className}
        src={props.src}
        width={dimensions.width}
        height={dimensions.height} />;
}
