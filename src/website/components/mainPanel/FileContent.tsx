import React from "react";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { FileContent as File } from "../../domain/model/messages";
import dataService, { DataSource } from "../../services/data/CachingDataService";
import { dataToBlobUrl } from "../../utils/blobFunctions";

export interface Props {
    content: File,
    sentByMe: boolean
}

export default React.memo(FileContent);

const useStyles = makeStyles<Theme, Props>((theme: Theme) => ({
    link: {
        padding: "10px 9px",
        fontSize: 14,
        lineHeight: 1,
        textDecoration: "none",
        display: "flex",
        alignItems: "center"
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
        color: props => props.sentByMe ? theme.colors.messageSentByMe.textColor : theme.colors.messageSentByElse.textColor
    }
}));

function FileContent(props : Props): JSX.Element {
    const classes = useStyles(props);
    const content = props.content;

    let downloading = false;
    let title = content.blobDeleted ? `"${content.name}" no longer available` : `Download "${content.name}"`;
    let name = content.blobDeleted ? `${content.name} no longer available` : content.name;

    return (
        <a 
            className={classes.link}
            href="#"
            role="button"
            onClick={onClick}
            title={title}>
            <div className={classes.icon}></div>
            <div className={classes.fileName}>{name}</div>
        </a>
    );

    async function onClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {

        if (content.blobDeleted) {
            return;
        }

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
