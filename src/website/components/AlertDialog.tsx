import React, { useState } from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import { Option } from "../domain/model/common";

export default AlertDialog;

export interface Props {
    content: Option<AlertContent>,
    onClose?: () => void
}

export interface AlertContent {
    title: string,
    message: string,
}

function AlertDialog(props: Props): JSX.Element {
    function onClose() {
        if (props.onClose) {
            props.onClose();
        }
    }

    return (
        <Dialog
            open={props.content != null}
            onClose={onClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{props.content?.title ?? ""}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {props.content?.message ?? ""}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Continue
                </Button>
            </DialogActions>
        </Dialog>  
    );
}