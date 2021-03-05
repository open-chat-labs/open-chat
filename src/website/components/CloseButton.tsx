import React from "react";
import IconButton from "@material-ui/core/IconButton";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import CloseIcon from '@material-ui/icons/Close';

export default React.memo(CloseButton);

const useStyles = makeStyles((theme: Theme) => ({
    closeButton: {
        padding: 8
    }
}));

type Props = {
    onClick: () => void,
    className: string
}

CloseButton.defaultProps = {
    className: ""
}

function CloseButton(props: Props) {
    const classes = useStyles();

    return (
        <IconButton onClick={props.onClick} className={props.className.length ? " " + props.className : classes.closeButton}>
            <CloseIcon />
        </IconButton>
    );
}