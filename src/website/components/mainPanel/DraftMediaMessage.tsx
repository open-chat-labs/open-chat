import React from "react";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import Box from "@material-ui/core/Box";
import Image from "../shared/Image";
import Video from "../shared/Video";

type Props = {
    width: number,
    height: number,
    mimeType: string,
    blobUrl: string
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles<Theme>((theme: Theme) => ({
    media: {
        minWidth: 250,
        maxWidth: 500,
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
    return (
        <Box className={classes.media}>
            {props.mimeType.startsWith("image/") 
            ? <Image src={props.blobUrl} /> 
            : <Video src={props.blobUrl} />}
        </Box>
    );
}