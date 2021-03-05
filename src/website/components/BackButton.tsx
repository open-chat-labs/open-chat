import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";

export default React.memo(BackButton);

const useStyles = makeStyles((theme: Theme) => ({
    closeButton: {
        height: theme.avatarSize.sm,
        width: theme.avatarSize.sm
    }
}));

type Props = {
    onClick: () => void,
    className: string
}

function BackButton(props: Props) {
    const classes = useStyles();

    return (
        <IconButton onClick={props.onClick} className={classes.closeButton + " " + props.className}>
            <ArrowBackIcon />
        </IconButton>
    );
}