import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { RootState } from "../reducers";
import CancelButton from "./shared/CloseButton";
import * as notifications from "../webpush/notifications";
import Backdrop from "@material-ui/core/Backdrop";

export type Props = {
    onRender: (render: boolean) => void,
};

export default React.memo(NotificationBar);

const useStyles = makeStyles((_theme: Theme) => ({
    topBar: {
        display: "flex",
        height: 32,
        padding: 4,
        textAlign: "center",
        backgroundColor: "#dea941",
        color: "white",
        "& button": {
            background: "none!important",
            textDecoration: "underline",
            backgroundColor: "inherit",
            color: "inherit",
        }
    },
    message: {
        flex: "1 0 auto",
    },  
    cancelButton: {
        width: 0,
        height: 0,
    },
}));

function NotificationBar(props: Props): JSX.Element {
    const classes = useStyles();
    const myUserId = useSelector((state: RootState) => state.usersState.me?.userId!);
    const [showBar, setShowBar] = useState(false);
    const [showBackdrop, setShowBackdrop] = useState(false);

    useEffect(() => {
        (async () => {
            if (!process.env.ENABLE_NOTIFICATIONS) {
                return;
            }
            let status = await notifications.status();
            if (status === notifications.Status.Prompt) {
                renderBar(true);
            } else if (status === notifications.Status.Granted) {
                notifications.trySubscribe(myUserId);
            }
        })()            
    }, []);

    function renderBar(render: boolean) {
        setShowBar(render);
        props.onRender(render);
    }

    async function onEnable() {
        setShowBackdrop(true);
        try {
            let permission = await notifications.askForPermission();
            renderBar(false);
            if (permission === "granted") {
                notifications.trySubscribe(myUserId);
            }
        } finally {
            setShowBackdrop(false);
        }
    }

    return (
        <>
            <Backdrop
                open={showBackdrop}
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            ></Backdrop>        
            { showBar ? 
            <div className={classes.topBar}>
                <div className={classes.message}>OpenChat needs your permission to <button onClick={onEnable}>enable notifications</button>.</div>
                <CancelButton onClick={() => setShowBar(false)} className={classes.cancelButton} />
            </div> : null }
        </>
    );
}
