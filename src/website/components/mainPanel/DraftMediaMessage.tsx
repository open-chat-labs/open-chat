import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import Image from "../shared/Image";
import Video from "../shared/Video";

type Props = {
    width: number,
    height: number,
    mimeType: string,
    blobUrl: string
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles(() => ({
    container: {    
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    media: {
        margin: 14,
        marginBottom: 4,
        borderRadius: 16,
        "& *": {
            borderRadius: "inherit"
        },
        "& img": {
            maxWidth: 400,
            maxHeight: 300,
            width: "auto",
            height: "auto"
        }
    }
}));

function DraftMediaMessage(props: Props): JSX.Element {
    const classes = useStyles();
    return (
        <div className={classes.container}>
            <div className={classes.media}>
                {props.mimeType.startsWith("image/") 
                ? <Image src={props.blobUrl} /> 
                : <Video src={props.blobUrl} />}
            </div>
        </div>
    );
}