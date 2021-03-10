import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import Box from "@material-ui/core/Box";
import { scaleMediaContent } from "./mediaComponentFunctions";
import Image from "./Image";
import Video from "./Video";

type Props = {
    width: number,
    height: number,
    mimeType: string,
    blobUrl: string
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles(() => ({
    media: {
        margin: 14,
        marginBottom: 4,
        borderRadius: 16,
        "& *": {
            borderRadius: "inherit"
        }
    }
}));

function DraftMediaMessage(props: Props): JSX.Element {
    const classes = useStyles();
    const dimensions = scaleMediaContent(props.width, props.height);

    return (
        <Box className={classes.media} width={dimensions.width} height={dimensions.height}>
            {props.mimeType.startsWith("image/") 
            ? <Image src={props.blobUrl} width={dimensions.width} height={dimensions.height} /> 
            : <Video src={props.blobUrl} width={dimensions.width} height={dimensions.height} />}
        </Box>
    );
}