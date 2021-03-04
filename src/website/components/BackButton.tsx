import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ArrorBackIcon from '@material-ui/icons/ArrowBack';
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

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
            <ArrorBackIcon />
        </IconButton>
    );
}