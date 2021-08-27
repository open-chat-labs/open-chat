import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import makeStyles from "@material-ui/styles/makeStyles";
import { Theme } from "@material-ui/core/styles/createMuiTheme";
import { RootState } from "../reducers";
import CancelButton from "./shared/CloseButton";
import * as notifications from "../notifications";
import Backdrop from "@material-ui/core/Backdrop";
import { ViewMode } from "../domain/model/viewMode";

export type Props = {
    onRender: (render: boolean) => void,
};

export default React.memo(NotificationBar);

const useStyles = makeStyles((theme: Theme) => ({
    topBar: {
        display: "flex",
        height: 32,
        padding: 4,
        textAlign: "center",
        alignItems: "center",
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
        [theme.breakpoints.down('sm')]: {
            fontSize: "14px"
        },        
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
    const viewMode = useSelector((state: RootState) => state.appState.viewMode);

    useEffect(() => {
        (async () => {
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

    const message = viewMode === ViewMode.Mobile ? "Give permission to " : "OpenChat needs your permission to ";

    return (
        <>
            <Backdrop
                open={showBackdrop}
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            ></Backdrop>        
            { showBar ? 
            <div className={classes.topBar}>
                <div className={classes.message}>{message}<button onClick={onEnable}>enable notifications</button></div>
                <CancelButton onClick={() => setShowBar(false)} className={classes.cancelButton} />
            </div> : null }
        </>
    );
}
