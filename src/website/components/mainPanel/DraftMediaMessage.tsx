import React from "react";
import { useSelector } from "react-redux";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { RootState } from "../../reducers";
import { ViewMode } from "../../domain/model/viewMode";
import Image from "../shared/Image";
import Video from "../shared/Video";
import Dimensions from "../../utils/Dimensions";

type Props = {
    width: number,
    height: number,
    mimeType: string,
    blobUrl: string
}

type StyleProps = {
    width: number,
    height: number,
}

export default React.memo(DraftMediaMessage);

const useStyles = makeStyles<Theme, StyleProps>((_: Theme) => ({
    media: {
        margin: 14,
        marginBottom: 4,
        borderRadius: 16,
        width: props => props.width,
        height: props => props.height,
        "& *": {
            borderRadius: "inherit"
        }
    }
}));

function DraftMediaMessage(props: Props): JSX.Element {
    const viewMode = useSelector((state: RootState) => state.appState.viewMode);
    const maxDim = viewMode === ViewMode.Desktop ? 440 : 290;
    const mediaDimensions = new Dimensions(props.width, props.height);
    const scaled = mediaDimensions.scaleToFit(new Dimensions(maxDim, maxDim));
    const styleProps = {
        width: scaled.width,
        height: scaled.height
    };
    const classes = useStyles(styleProps);

    return (
        <div className={classes.media}>
            {props.mimeType.startsWith("image/") 
            ? <Image src={props.blobUrl} /> 
            : <Video src={props.blobUrl} />}
        </div>
    );
}