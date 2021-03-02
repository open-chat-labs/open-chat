import authClient from "../utils/authClient";
import { Principal } from "@dfinity/agent";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import React from "react";

type Props = {
    canisterIds: {
        chats: Principal,
        p2p: Principal,
        userMgmt: Principal
    }
}

export default function Login(props: Props) {
    async function login() {
        const redirectUri = `${location.origin}/${location.search}`;
        await authClient.loginWithRedirect({
            redirectUri,
            scope: Object.values(props.canisterIds)});
    }

    return (
        <Paper>
            <Button onClick={_ => login()}>Login</Button>
        </Paper>
    );
}