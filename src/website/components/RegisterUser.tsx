import { useDispatch } from "react-redux";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import { alpha } from "@material-ui/core/styles/colorManipulator";
import Paper from "@material-ui/core/Paper";
import React from "react";
import PersonIcon from '@material-ui/icons/Person';
import Typography from "@material-ui/core/Typography";
import NameInput from "./NameInput";
import registerUser from "../actions/users/registerUser";

const useStyles = makeStyles((theme: Theme) => ({
    paper: {
        textAlign: "center",
        padding: 20
    },
    icon: {
        width: 80,
        height: 80
    },
    button: {
        backgroundColor: theme.customColors.mainPanelBackgroundColor,
        "&:hover": {
            backgroundColor: alpha(theme.customColors.mainPanelBackgroundColor, 0.1),
        }
    },
    nameInput: {
        margin: "auto",
        maxWidth: 400
    }
}));

export default function RegisterUser() {
    const dispatch = useDispatch();
    const classes = useStyles();

    function handleSubmit(text: string) {
        if (text && text.length > 2) {
            dispatch(registerUser(text));
        }
    }

    return (
        <Paper className={classes.paper}>
            <PersonIcon className={classes.icon} />
            <Typography variant="h2">Register user</Typography>
            <p>Please choose a username:</p>
            <NameInput onSubmit={handleSubmit} defaultPlaceholderText="Enter username" minLength={3} maxLength={25} className={classes.nameInput} />
        </Paper>
    );
}