import { showAlertDialog, ShowAlertDialogRequestedEvent } from "./showAlertDialog";

export default function() : ShowAlertDialogRequestedEvent {
    return showAlertDialog({
        title: "TEST MODE",
        message: "OpenChat is running in test mode. Maximum users 10,000. Old media files scavenged. Dummy cycle balance. Accounts may get reset on coming beta release. Enjoy! - OpenChat devs"
    });
}
