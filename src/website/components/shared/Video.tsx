import React from "react";

export interface Props {
    src: string
    width?: number,
    height?: number,
    className: string
}

Video.defaultProps = {
    className: ""
}

export default React.memo(Video);

function Video(props : Props): JSX.Element {
    return <video 
        className={props.className}
        controls
        width={props.width}
        height={props.height}>
        <source src={props.src}/>Your browser does not support the video tag
    </video>;
}
