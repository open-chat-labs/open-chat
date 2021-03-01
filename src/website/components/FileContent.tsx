import React from "react";
import { alpha, makeStyles, Theme } from "@material-ui/core";
import { FileContent as File } from "../domain/model/messages";
import dataService, { DataSource } from "../services/data/CachingDataService";
import formatFileSize from "../formatters/fileSize";
import { dataToBlobUrl } from "../utils/blobFunctions";

export interface Props {
    content: File,
    sentByMe: boolean,
    mergeWithPrevious: boolean
}

export default React.memo(FileContent);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    link: {
        minWidth: 300,
        padding: "10px 9px",
        maxWidth: 494,
        backgroundColor: props => props.sentByMe ? theme.customColors.messageSentByMe.backgroundColor : theme.customColors.messageSentByElse.backgroundColor,
        filter: props => props.sentByMe ? "brightness(1.1)" : "brightness(0.9)",
        fontSize: 14,
        lineHeight: 1,
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
        borderRadius: props => `${props.mergeWithPrevious && !props.sentByMe ? "2" : "13"}px ${props.mergeWithPrevious && props.sentByMe ? "2" : "13"}px 6px 6px`
    },
    icon: {
        backgroundImage: "url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAA8CAYAAADL94L/AAAByElEQVR4Ae3axdJTQRAFYFyegA3u8ALseCDcicsGhxt3x+G32BXc3X3NBnfXYTqp3sZlhuqpOlXZRL46He9ReJyJxGSTEreaPfEHZiX+1uSJvelVNu+Jvjd7Yk9zI8aSUe0eDpjCIYfNSuw5v/zF5In/6mU27478tXriLJvXjdSwPq1lCDTCmxjiCNav8GZYBVMwWKagX8kWjk9vCcMhYWhEFEw1+oV0wZjdPKY6Vn9EwmBDTYPwBoXCYPLGDQTJjkHQNQRJj0FQtmgs+C8wOHIIkh2DoDu5vD5Xfkz9hsTBWDyxhjDYUDqvLRYSY1JilSQGyyxXOt4QKJPX70NDQmI27gyxHcn9bH/5RFMNAUgoDI4afOAMHBiCdiDNj5woGAhgsCEYudSI1lBCRwoPL957slAoDDYEoPXb/ZVs3FE/y9072fDxsx4BMPVfGOpl1VY/y5++4EWM1Fm9LcCKpy8RpnchDGEIQxjCEIYwhCEMYQhDGMIQhjCEIQxhCEMYwhCGMIQhDGEIQxhYNlXiP+XHXLRDM5thQVpyzIfS2YtLceVEkRmzalsgMArPhp258bA6b/LEb8LqPM930VNdvY/fhMmCxw+Of+4BTcPInBo2AAAAAElFTkSuQmCC)",
        backgroundSize: "contain",
        width: 26,
        height: 30
    },
    fileName: {
        flex: "1 0 auto",
        marginLeft: 8,
        color: props => props.sentByMe ? theme.customColors.messageSentByMe.color : theme.customColors.messageSentByElse.color
    },
    fileSize: {
        margin: "6px 0 3px 9px",
        float: "left",
        textAlign: "left",
        display: "block",
        zIndex: 10,
        fontSize: 11,
        color: props => alpha(props.sentByMe ? theme.customColors.messageSentByMe.color : theme.customColors.messageSentByElse.color, 0.6)
    }
}));

function FileContent(props : Props): JSX.Element {
    const classes = useStyles(props);

    const content = props.content;

    let downloading = false;

    return (
        <>
            <a 
                className={classes.link}
                href="#"
                role="button"
                onClick={onClick}
                title={'Download "' + content.name + '"'}>
                <div className={classes.icon}></div>
                <div className={classes.fileName}>{content.name}</div>
            </a>
            <span className={classes.fileSize}>{content.mimeType.toUpperCase()} - {formatFileSize(content.size)}</span>
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
