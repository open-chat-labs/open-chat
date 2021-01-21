import React from "react";

export interface Props {
    id: string,
    data: Uint8Array
}

export default React.memo(Image);

function Image(props : Props): JSX.Element {
    const src = "data:*/*;base64," + btoa(props.data.reduce((data, byte) => data + String.fromCharCode(byte), ''));
    return <img src={src} />;
}
