import React from "react";
import { useDispatch } from "react-redux";
import { FileContent as File } from "../model/messages";
import getData, { GetDataOutcome, GET_DATA_FAILED } from "../actions/data/getData";
import formatFileSize from "../formatters/fileSize";

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
        let result: GetDataOutcome;
        {
            downloading = true;

            const getDataAsync: () => Promise<GetDataOutcome> = () => dispatch(getData(
                content.id,
                content.mimeType,
                content.size,
                content.chunkSize,
                false)) as any;	

            result = await getDataAsync();

            downloading = false;

            if (result.type === GET_DATA_FAILED) {
                return;
            }
        }

        // Point anchor at blob and re-click it to trigger download
        const blobUrl = dataToBlobUrl(result.payload.data, content.mimeType);
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

function dataToBlobUrl(data: Uint8Array, type: string): string {
    const blob = new Blob([data], { type });
    return URL.createObjectURL(blob);
}
