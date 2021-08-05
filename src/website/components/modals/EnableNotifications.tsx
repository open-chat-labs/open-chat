import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";

import { create, InstanceProps } from "react-modal-promise";

//type 

interface Props extends InstanceProps<boolean> {
    title?: string
    text?: string
}

const Modal: React.FC<Props> = ({ title, text, isOpen, onResolve }) => {
    const onClose = () => onResolve(true);

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{title ?? ""}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {text ?? ""}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Continue
                </Button>
            </DialogActions>
        </Dialog>  
    );
};

export const enableNotificationsDialog = create(Modal);
