import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import formatFileSize from "../../formatters/fileSize";

type Props = {
    mimeType: string,
    name: string,
    size: number
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles(() => ({
    container: {
        padding: 2,
        backgroundColor: "#aaaaaa",
    },
    file: {
        minWidth: 300,
        padding: "10px 9px",
        backgroundColor: "#aaaaaa",
        fontSize: 14,
        lineHeight: 1,
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
    },
    fileSize: {
        margin: "6px 0 3px 9px",
        float: "left",
        textAlign: "left",
        display: "block",
        zIndex: 10,
        fontSize: 11,
    }
}));

function DraftMediaMessage(props: Props): JSX.Element {
    const classes = useStyles();

    return (
        <div className={classes.container}>
            <div className={classes.file}>
                <div className={classes.icon}></div>
                <div className={classes.fileName}>{props.name}</div>
            </div>
            <span className={classes.fileSize}>{props.mimeType.toUpperCase()} - {formatFileSize(props.size)}</span>
        </div>
    );
}