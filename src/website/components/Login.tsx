import { Theme } from "@material-ui/core/styles/createMuiTheme";
import makeStyles from "@material-ui/styles/makeStyles";
import authClient from "../utils/authClient";
import { Principal } from "@dfinity/agent";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import React from "react";
import ChatIcon from '@material-ui/icons/Chat';
import Typography from "@material-ui/core/Typography";

type Props = {
    canisterIds: {
        chats: Principal,
        p2p: Principal,
        userMgmt: Principal
    }
}

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
            backgroundColor: theme.customColors.mainPanelBackgroundColor,
        }
    }
}));

export default function Login(props: Props) {
    const classes = useStyles();

    async function login() {
        const redirectUri = `${location.origin}/${location.search}`;
        await authClient.loginWithRedirect({
            redirectUri,
            scope: Object.values(props.canisterIds)});
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