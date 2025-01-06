const fishy = ["5qha5-vqaaa-aaaar-asssq-cai", "uzklx-viaaa-aaaaf-bo7aq-cai"];

export function trace(userId: string, username: string, json: object) {
    if (!fishy.includes(userId)) return;

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
            stack: err.stack,
        }),
    }).catch((err) => console.warn("Trace logging failed", err));
}
