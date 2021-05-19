import { AlertContent } from "../components/AlertDialog";

export const SHOW_ALERT_DIALOG_REQUESTED = "SHOW_ALERT_DIALOG_REQUESTED";
export const CLOSE_ALERT_DIALOG_REQUESTED = "CLOSE_ALERT_DIALOG_REQUESTED";

export function showAlertDialog(alert: AlertContent) : ShowAlertDialogRequestedEvent {
    return {
        type: SHOW_ALERT_DIALOG_REQUESTED,
        payload: alert
    };
}

export function closeAlertDialog() : CloseAlertDialogRequestedEvent {
    return {
        type: CLOSE_ALERT_DIALOG_REQUESTED
    };
}

export type ShowAlertDialogRequestedEvent = {
    type: typeof SHOW_ALERT_DIALOG_REQUESTED,
    payload: AlertContent
}

export type CloseAlertDialogRequestedEvent = {
    type: typeof CLOSE_ALERT_DIALOG_REQUESTED
}
