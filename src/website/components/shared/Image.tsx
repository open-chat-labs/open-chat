import React from "react";

export interface Props {
    src: string,
    width?: number,
    height?: number,
    className: string
}

Image.defaultProps = {
    className: ""
}

export default React.memo(Image);

function Image(props : Props): JSX.Element {
    return <img
        className={props.className}
        src={props.src}
        width={props.width}
        height={props.height} />;
}
