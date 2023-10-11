let reqId = 0;
let iiWindow: Window | null | undefined;
let eventHandler: ((event: MessageEvent) => void) | undefined;
let closeHandler: (() => void) | undefined;

function cleanUp() {
    if (eventHandler !== undefined) {
        window.removeEventListener("message", eventHandler);
    }
    if (iiWindow && closeHandler !== undefined) {
        iiWindow.removeEventListener("unload", closeHandler);
    }
    closeHandler = undefined;
    eventHandler = undefined;
    iiWindow?.close();
    iiWindow = undefined;
}

function getEventHandler(
    id: number,
    principal: string,
    issuerOrigin: string,
    credentialId: string,
    url: URL,
    onSuccess: (result: string) => void,
    _onError: (err: unknown) => void,
): (event: MessageEvent) => void {
    return (ev: MessageEvent) => {
        console.debug("VC: received message on window: ", ev);
        if (ev.origin === url.origin) {
            console.debug("VC: message from correct origin received", ev.data);
            if ("method" in ev.data) {
                if (ev.data.method === "vc-flow-ready") {
                    iiWindow?.postMessage(
                        {
                            id,
                            jsonrpc: "2.0",
                            method: "request_credential",
                            params: {
                                issuer: {
                                    issuerOrigin: issuerOrigin,
                                    credentialId: credentialId,
                                },
                                credentialSubject: principal,
                            },
                        },
                        url.origin,
                    );
                }
            }
            if ("result" in ev.data && "verifiablePresentation" in ev.data.result) {
                if (ev.data.id === id) {
                    console.debug(
                        "VC: verification result received",
                        ev.data.result.verifiablePresentation,
                    );
                    onSuccess(ev.data.result.verifiablePresentation);
                } else {
                    console.warn(
                        `VC: WARNING: received a verified credential correlated with a different request - ignoring`,
                    );
                }
            }
        } else {
            console.warn(
                `VC: WARNING: expected origin '${url.origin}', got '${ev.origin}' (ignoring)`,
            );
        }
    };
}

function onSuccess(resolve: (result: string) => void): (result: string) => void {
    return (result: string) => {
        cleanUp();
        resolve(result);
    };
}

function onError(reject: (err: unknown) => void): (err: unknown) => void {
    return (err: unknown) => {
        cleanUp();
        reject(err);
    };
}

export function verifyCredential(
    iiUrl: string,
    principal: string,
    issuerOrigin: string,
    credentialId: string,
): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
        cleanUp();

        console.debug(
            "VC: about to verify credential",
            iiUrl,
            principal,
            issuerOrigin,
            credentialId,
        );

        reqId = reqId + 1;
        const url = new URL(iiUrl);
        url.pathname = "vc-flow/";

        console.debug("VC: opening II at url", url.toString());

        eventHandler = getEventHandler(
            reqId,
            principal,
            issuerOrigin,
            credentialId,
            url,
            onSuccess(resolve),
            onError(reject),
        );
        window.addEventListener("message", eventHandler);

        iiWindow = window.open(url);
        closeHandler = () => {
            console.debug("VC: ii window closed - rejecting promise");
            reject("VC: II window closed");
        };

        if (iiWindow) {
            console.debug("VC: setting close handler on iiWindow");
            iiWindow.addEventListener("unload", closeHandler);
        }
    });
}
