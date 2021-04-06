import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import authClient from "../utils/authClient";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import React from "react";
import ChatIcon from '@material-ui/icons/Chat';
import Typography from "@material-ui/core/Typography";
import { getCanisterIds } from "../utils/canisterFunctions";

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

    async function login() {
        const redirectUri = `${location.origin}/${location.search}`;
        const canisterIds = getCanisterIds();

        await authClient.loginWithRedirect({
            redirectUri,
            scope: Object.values(canisterIds)
        });
    }

    return (
        <Paper className={classes.paper}>
            <ChatIcon className={classes.icon} />
            <Typography variant="h1">OPEN CHAT</Typography>
            <p>Welcome to Open Chat!</p>
            <p>Before continuing you must sign-in to the Internet Computer.</p>
            <Button size="large" variant="contained" className={classes.button} onClick={_ => login()}>Sign-in</Button>
        </Paper>
    );
}
