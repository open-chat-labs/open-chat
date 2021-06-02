import React from "react";

export interface Props {
    src: string,
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
        width="100%"
        height="100%" />;
}
