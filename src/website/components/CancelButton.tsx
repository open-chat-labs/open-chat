import React from "react";
import { IconButton, makeStyles, Theme } from "@material-ui/core";
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