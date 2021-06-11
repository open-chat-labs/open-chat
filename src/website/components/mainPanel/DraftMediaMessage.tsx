import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import Image from "../shared/Image";
import Video from "../shared/Video";
import { Theme } from "@material-ui/core";

type Props = {
    width: number,
    height: number,
    mimeType: string,
    blobUrl: string
}

type StyleProps = {
    isLandscape: boolean
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles<Theme, StyleProps>(() => ({
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
            maxWidth: props => props.isLandscape ? "calc(var(--vh, 1vh) * 50)" : "none",
            maxHeight: props => props.isLandscape ? "none" : "calc(var(--vh, 1vh) * 50)",
            width: props => props.isLandscape ? "100%" : "auto",
            height: props => props.isLandscape ? "auto" : "100%",
        }
    }
}));

function DraftMediaMessage(props: Props): JSX.Element {
    const classes = useStyles({isLandscape: props.width > props.height});
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