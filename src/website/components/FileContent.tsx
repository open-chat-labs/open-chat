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
                title={'Download "' + props.content.name + '"'}>
                <div className="file-icon"></div>
                <div className="file-name">{props.content.name}</div>
            </a>
            <span className="file-size">{props.content.mimeType.toUpperCase()} - {formatFileSize(props.content.size)}</span>
        </>
    );

    async function onClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {

        const anchor = e.target as HTMLAnchorElement;

        // If the file is already downloading or the anchor is now pointing at the blob then return
        if (downloading || anchor.href && anchor.href.startsWith("blob")) {
            return;
        }

        // Get the file from the IC
        let result: GetDataOutcome;
        {
            downloading = true;

            const getDataAsync: () => Promise<GetDataOutcome> = () => dispatch(getData(
                content.id, 
                content.size, 
                content.chunkSize,
                false)) as any;	

            result = await getDataAsync();

            downloading = false;

            if (result.type === GET_DATA_FAILED) {
                console.log("Failed to download file");
                return;
            }
        }

        // Point anchor at blob and re-click it to trigger download
        anchor.href = dataToBlobUrl(result.payload.data, content.mimeType);
        anchor.download = content.name;
        anchor.click();

        // Reset anchor back to initial state and remove the blob from memory
        URL.revokeObjectURL(anchor.href);
        anchor.removeAttribute("download");
        anchor.href = "#";
    }
}

function dataToBlobUrl(data: Uint8Array, mimeType: string): string {
    const blob = new Blob([data], {type : mimeType});
    return URL.createObjectURL(blob);
}
