import { load as botCheck } from "@fingerprintjs/botd";

const suspiciousUserIds = process.env.SUSPICIOUS_USERIDS!;

export async function trace(userId: string, username: string, json: object) {
    if (suspiciousUserIds === undefined || !suspiciousUserIds.includes(userId)) return;

    const botd = await botCheck();

    const err = new Error();
    let headers = new Headers();
    headers.append("Content-Type", "application/json");
    fetch("https://webhook.site/9ac7d01b-9d53-48b4-913a-4ce2f1d924bd", {
        method: "POST",
        mode: "no-cors",
        headers,
        body: JSON.stringify({
            ...json,
            username,
            bot: botd.detect(),
            stack: err.stack,
        }),
    }).catch((err) => console.warn("Trace logging failed", err));
}
