import React from "react";
import { useDispatch } from "react-redux";
import { FileContent as File } from "../domain/model/messages";
import dataService, { DataSource } from "../services/data/CachingDataService";
import formatFileSize from "../formatters/fileSize";
import { dataToBlobUrl } from "../utils/blobFunctions";

export interface Props {
    content: File
}

export default React.memo(FileContent);

function FileContent(props : Props): JSX.Element {

    const dispatch = useDispatch();

    const content = props.content;

    let downloading = false;

    return (
        <>
            <a 
                className="download-file" 
                href="#" 
                role="button" 
                onClick={onClick}
                title={'Download "' + content.name + '"'}>
                <div className="file-icon"></div>
                <div className="file-name">{content.name}</div>
            </a>
            <span className="file-size">{content.mimeType.toUpperCase()} - {formatFileSize(content.size)}</span>
        </>
    );

    async function onClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
        const anchor = findAnchor(e.target);
        const href = anchor.getAttribute("href");

        // If the file is already downloading or the anchor is now pointing at the blob then return
        if (downloading ||  href && href.startsWith("blob")) {
            return;
        }

        // Get the file from the IC
        downloading = true;

        const result = await dataService.getData(
            DataSource.FileMessage, 
            content.id, 
            content.size, 
            content.chunkSize);

        downloading = false;
        if (result.kind !== "success") {
            return;
        }

        // Point anchor at blob and re-click it to trigger download
        const blobUrl = dataToBlobUrl(result.data, content.mimeType);
        anchor.setAttribute("href", blobUrl);
        anchor.setAttribute("download", content.name)
        anchor.click();

        // Reset anchor back to initial state and remove the blob from memory
        URL.revokeObjectURL(anchor.href);
        anchor.removeAttribute("download");
        anchor.setAttribute("href", "#");
    }

    function findAnchor(node: any) : HTMLAnchorElement {
        while (node != null && !(node instanceof HTMLAnchorElement)) {
            node = node.parentNode;
        }
        return node;
    }
}
