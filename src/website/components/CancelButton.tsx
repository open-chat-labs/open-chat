import React from "react";
import IconButton from "@material-ui/core/IconButton";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import CancelIcon from "../assets/icons/cancelIcon.svg";

export default React.memo(CancelButton);

const useStyles = makeStyles((theme: Theme) => ({
    closeButton: {
        padding: 8
    }
}));

type Props = {
    onClick: () => void
}

function CancelButton(props: Props) {
    const classes = useStyles();

    return (
        <IconButton onClick={props.onClick} className={classes.closeButton}>
            <CancelIcon />
        </IconButton>
    );
}