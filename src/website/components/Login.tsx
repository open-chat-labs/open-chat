import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import React from "react";
import { useDispatch } from "react-redux";
import login from "../actions/signin/login";

const useStyles = makeStyles((theme: Theme) => ({
    paper: {
        color: theme.colors.loginRegister.textColor,
        backgroundColor: theme.colors.loginRegister.backgroundColor,
        textAlign: "center",
        padding: 20
    },
    icon: {
        width: 80,
        height: 80
    },
    button: {
        color: theme.colors.loginRegister.buttonTextColor,
        backgroundColor: theme.colors.loginRegister.buttonBackgroundColor,
        "&:hover": {
            backgroundColor: theme.colors.loginRegister.buttonBackgroundColor,
        }
    }
}));

export default function Login() {
    const classes = useStyles();
    const dispatch = useDispatch();

    return (
        <Paper className={classes.paper}>
            <img src="oc-logo2.svg" className={classes.icon} />
            <h1>OpenChat</h1>
            <p>Welcome to OpenChat!</p>
            <p>Before continuing you must sign-in to the Internet Computer.</p>
            <Button size="large" variant="contained" className={classes.button} onClick={_ => dispatch(login())}>Sign-in</Button>
        </Paper>
    );
}
