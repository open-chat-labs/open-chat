let reqId = 0;
let iiWindow: Window | null | undefined;
let eventHandler: ((event: MessageEvent) => void) | undefined;

const INTERRUPT_CHECK_INTERVAL = 500;

function cleanUp() {
    if (eventHandler !== undefined) {
        window.removeEventListener("message", eventHandler);
    }
    eventHandler = undefined;
    iiWindow?.close();
    iiWindow = undefined;
}

function getEventHandler(
    id: number,
    principal: string,
    issuerOrigin: string,
    credentialType: string,
    credentialArguments: unknown,
    derivationOrigin: string | undefined,
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
                    const msg = {
                        id,
                        jsonrpc: "2.0",
                        method: "request_credential",
                        params: {
                            issuer: {
                                origin: issuerOrigin,
                            },
                            credentialSubject: principal,
                            credentialSpec: {
                                credentialType,
                                arguments: credentialArguments,
                            },
                            derivationOrigin,
                        },
                    };
                    console.debug("VC: sending request_credential msg: ", msg);
                    iiWindow?.postMessage(msg, url.origin);
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

function checkInterruption(reject: (err: unknown) => void): void {
    if (iiWindow) {
        if (iiWindow.closed) {
            reject("II reason was closed");
            cleanUp();
        } else {
            window.setTimeout(() => checkInterruption(reject), INTERRUPT_CHECK_INTERVAL);
        }
    }
}

export function verifyCredential(
    iiUrl: string,
    principal: string,
    issuerOrigin: string,
    credentialType: string,
    credentialArguments: unknown,
    derivationOrigin: string | undefined,
): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
        cleanUp();

        console.debug(
            "VC: about to verify credential",
            iiUrl,
            principal,
            issuerOrigin,
            credentialType,
        );

        reqId = reqId + 1;
        const url = new URL(iiUrl);
        url.pathname = "vc-flow/";

        console.debug("VC: opening II at url", url.toString());

        eventHandler = getEventHandler(
            reqId,
            principal,
            issuerOrigin,
            credentialType,
            credentialArguments,
            derivationOrigin,
            url,
            onSuccess(resolve),
            onError(reject),
        );
        window.addEventListener("message", eventHandler);

        iiWindow = window.open(url);

        checkInterruption(reject);
    });
}
