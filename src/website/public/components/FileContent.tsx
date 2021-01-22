import React from "react";
import { FileContent as File } from "../model/messages";

export interface Props {
    content: File
}

export default React.memo(FileContent);

function FileContent(props : Props): JSX.Element {
    return (
        <>
            <div>{props.content.name}</div>
            <span className="file-size">{props.content.mimeType.toUpperCase()} - {props.content.size} B</span>
        </>
    );
}
