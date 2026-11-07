// This browser's notifications (web push), as the web's profile and the native Notifications
// settings switch them, the old UI's way: turning them on asks for the browser's permission (and
// stops them being "soft" denied), turning them off only stops the app offering them here
// (soft-denied): the browser's permission stays, as a site can't take it back. The native apps'
// notifications are the phone's own, which this doesn't reach.

import type { NotificationStatus } from "@client";

/** What a notifications switch shows. */
export type NotificationSwitch =
    // no web push here: an app, an old browser, or no account
    | { kind: "unsupported" }
    // the browser blocks them for the site: only its settings can allow them again
    | { kind: "blocked" }
    | { kind: "switch"; on: boolean };

export function notificationSwitch(status: NotificationStatus): NotificationSwitch {
    switch (status) {
        case "unsupported":
            return { kind: "unsupported" };
        case "hard-denied":
            return { kind: "blocked" };
        case "granted":
            return { kind: "switch", on: true };
        case "pending-init":
        case "prompt":
        case "soft-denied":
            return { kind: "switch", on: false };
    }
}

/** How the switch reaches the browser (askForNotificationPermission, setSoftDisabled). */
export type NotificationControls = {
    ask: () => Promise<unknown>;
    softDisable: (disabled: boolean) => void;
};

/** Turns this browser's notifications on (asking for its permission) or off. */
export async function setNotifications(
    on: boolean,
    status: NotificationStatus,
    controls: NotificationControls,
): Promise<void> {
    if (!on) return controls.softDisable(true);
    // where there are no notifications, asking would throw
    if (status === "unsupported") return;
    try {
        await controls.ask();
    } catch (err) {
        console.warn("Unable to ask for notification permission", err);
    }
}
