import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../reducers";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import logout from "../actions/signin/logout";

export default SessionExpiredDialog;

function SessionExpiredDialog(): JSX.Element {
    const dispatch = useDispatch();
    const sessionExpired = useSelector((state: RootState) => state.usersState.sessionExpired);

    const handleCloseSessionExpiredDialog = () => {
        dispatch(logout());
    };

    return (
        <Dialog
            open={sessionExpired}
            onClose={handleCloseSessionExpiredDialog}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{"Session Expired"}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    Your session has expired. You now need to sign-in again.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseSessionExpiredDialog} color="primary">
                    Continue
                </Button>
            </DialogActions>
        </Dialog>  
    );
}