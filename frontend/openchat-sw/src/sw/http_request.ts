/**
 * Implement the HttpRequest to Canisters Proposal.
 *
 */
import { Actor, ActorSubclass, HttpAgent, concat } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { validateBody } from "./validation";
import * as base64Arraybuffer from "base64-arraybuffer";
import * as pako from "pako";
import { HttpRequest, _SERVICE } from "../http-interface/canister_http_interface_types";
import { idlFactory } from "../http-interface/canister_http_interface";
import { streamContent } from "./streaming";

const hostnameCanisterIdMap: Record<string, [string, string]> = {
    "identity.ic0.app": ["rdmx6-jaaaa-aaaaa-aaadq-cai", "ic0.app"],
    "nns.ic0.app": ["qoctq-giaaa-aaaaa-aaaea-cai", "ic0.app"],
    "dscvr.one": ["h5aet-waaaa-aaaab-qaamq-cai", "ic0.app"],
    "dscvr.ic0.app": ["h5aet-waaaa-aaaab-qaamq-cai", "ic0.app"],
    "personhood.ic0.app": ["g3wsl-eqaaa-aaaan-aaaaa-cai", "ic0.app"],
    "test.oc.app": ["pfs7b-iqaaa-aaaaf-abs7q-cai", "ic0.app"],
    "webtest.oc.app": ["xp7uu-xyaaa-aaaaf-aoa6a-cai", "ic0.app"],
    "oc.app": ["6hsbt-vqaaa-aaaaf-aaafq-cai", "ic0.app"],
    // NOTE: for this to work you need to deploy the website (dfx deploy website) to your local replica and use the canister ID of the website here
    localhost: ["wflfh-4yaaa-aaaaa-aaata-cai", "localhost:8080"],
};

const shouldFetchRootKey = Boolean(process.env.FORCE_FETCH_ROOT_KEY);

console.log("ShouldFetchRootKey: ", shouldFetchRootKey);

function getServiceWorkerDomain(): string {
    const swLocation = new URL(self.location.toString());

    return splitHostnameForCanisterId(swLocation.hostname)?.[1] ?? swLocation.hostname;
}
const swDomains = getServiceWorkerDomain();

/**
 * Split a hostname up-to the first valid canister ID from the right.
 * @param hostname The hostname to analyze.
 * @returns A canister ID followed by all subdomains that are after it, or null if no
 *     canister ID were found.
 */
function splitHostnameForCanisterId(hostname: string): [Principal, string] | null {
    const maybeFixed = hostnameCanisterIdMap[hostname];
    if (maybeFixed) {
        return [Principal.fromText(maybeFixed[0]), maybeFixed[1]];
    }

    const subdomains = hostname.split(".").reverse();
    const topdomains: string[] = [];
    for (const domain of subdomains) {
        try {
            const principal = Principal.fromText(domain);
            return [principal, topdomains.reverse().join(".")];
        } catch (_) {
            topdomains.push(domain);
        }
    }

    return null;
}

/**
 * Try to resolve the Canister ID to contact in the domain name.
 * @param hostname The domain name to look up.
 * @returns A Canister ID or null if none were found.
 */
function maybeResolveCanisterIdFromHostName(hostname: string): Principal | null {
    // Try to resolve from the right to the left.
    const maybeCanisterId = splitHostnameForCanisterId(hostname);
    if (maybeCanisterId && swDomains === maybeCanisterId[1]) {
        return maybeCanisterId[0];
    }

    return null;
}

/**
 * Try to resolve the Canister ID to contact in the search params.
 * @param searchParams The URL Search params.
 * @returns A Canister ID or null if none were found.
 */
function maybeResolveCanisterIdFromSearchParam(searchParams: URLSearchParams): Principal | null {
    const maybeCanisterId = searchParams.get("canisterId");
    if (maybeCanisterId) {
        try {
            return Principal.fromText(maybeCanisterId);
        } catch (e) {
            // Do nothing.
        }
    }

    return null;
}

/**
 * Try to resolve the Canister ID to contact from a URL string.
 * @param urlString The URL in string format (normally from the request).
 * @returns A Canister ID or null if none were found.
 */
function resolveCanisterIdFromUrl(urlString: string): Principal | null {
    try {
        const url = new URL(urlString);
        return (
            maybeResolveCanisterIdFromHostName(url.hostname) ||
            maybeResolveCanisterIdFromSearchParam(url.searchParams)
        );
    } catch (_) {
        return null;
    }
}

/**
 * Try to resolve the Canister ID to contact from headers.
 * @param headers Headers from the HttpRequest.
 * @returns A Canister ID or null if none were found.
 */
function maybeResolveCanisterIdFromHeaders(headers: Headers): Principal | null {
    const maybeHostHeader = headers.get("host");
    if (maybeHostHeader) {
        // Remove the port.
        const maybeCanisterId = maybeResolveCanisterIdFromHostName(
            maybeHostHeader.replace(/:\d+$/, "")
        );
        if (maybeCanisterId) {
            return maybeCanisterId;
        }
    }

    return null;
}

function maybeResolveCanisterIdFromHttpRequest(request: Request) {
    return (
        maybeResolveCanisterIdFromHeaders(request.headers) || resolveCanisterIdFromUrl(request.url)
    );
}

/**
 * Decode a body (ie. deflate or gunzip it) based on its content-encoding.
 * @param body The body to decode.
 * @param encoding Its content-encoding associated header.
 */
function decodeBody(body: Uint8Array, encoding: string): Uint8Array {
    switch (encoding) {
        case "identity":
        case "":
            return body;
        case "gzip":
            return pako.ungzip(body);
        case "deflate":
            return pako.inflate(body);
        default:
            throw new Error(`Unsupported encoding: "${encoding}"`);
    }
}

async function createAgentAndActor(
    url: string,
    canisterId: Principal,
    fetchRootKey: boolean
): Promise<[HttpAgent, ActorSubclass<_SERVICE>]> {
    const replicaUrl = new URL(url);
    const agent = new HttpAgent({ host: replicaUrl.toString() });
    if (fetchRootKey) {
        await agent.fetchRootKey();
    }
    const actor = Actor.createActor<_SERVICE>(idlFactory, {
        agent,
        canisterId: canisterId,
    });
    return [agent, actor];
}

/**
 * Removes legacy sub domains from the URL of the request.
 * Request objects cannot be mutated, so we have to clone them and
 * object spread does not work so we have to manually deconstruct the request.
 * If we create a new Request using the original one then the duplex property is not copied over, so we have to set it manually.
 * The duplex property also does not exist in the Typescript definitions so we need to cast to unknown.
 * Safari does not support creating a Request with a readable stream as a body, so we have to read the stream and set the body
 * as the UIntArray that is read.
 */
async function removeLegacySubDomains(originalRequest: Request): Promise<Request> {
    const url = new URL(originalRequest.url);
    const urlWithoutLegacySubdomain = `${url.protocol}//${swDomains}${url.pathname}`;

    if (url.href !== urlWithoutLegacySubdomain) {
        console.warn(
            `${url.hostname} refers to a legacy, deprecated sub domain. Please migrate to the latest version of @dfinity/agent-js and remove any subdomains from your 'host' configuration when creating the agent.`
        );
    }

    const {
        cache,
        credentials,
        headers,
        integrity,
        keepalive,
        method,
        mode,
        redirect,
        referrer,
        referrerPolicy,
        signal,
    } = originalRequest;

    const requestInit = {
        cache,
        credentials,
        headers,
        integrity,
        keepalive,
        method,
        mode,
        redirect,
        referrer,
        referrerPolicy,
        signal,
        duplex: "half",
    };

    if (!["HEAD", "GET"].includes(method)) {
        requestInit["body"] = await originalRequest.arrayBuffer();
    }

    return new Request(urlWithoutLegacySubdomain, requestInit as unknown);
}

/**
 * Box a request, send it to the canister, and handle its response, creating a Response
 * object.
 * @param request The request received from the browser.
 * @returns The response to send to the browser.
 * @throws If an internal error happens.
 */
export async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    /**
     * We refuse any request to /_/*
     */
    if (url.pathname.startsWith("/_/")) {
        return new Response(null, { status: 404 });
    }

    /**
     * We try to do an HTTP Request query.
     */
    const maybeCanisterId = maybeResolveCanisterIdFromHttpRequest(request);

    /**
     * We forward all requests to /api/ to the replica, as is.
     */
    if (url.pathname.startsWith("/api/") && (maybeCanisterId || url.hostname.endsWith(swDomains))) {
        const cleanedRequest = await removeLegacySubDomains(request);
        const response = await fetch(cleanedRequest);
        // force the content-type to be cbor as /api/ is exclusively used for canister calls
        const sanitizedHeaders = new Headers(response.headers);
        sanitizedHeaders.set("X-Content-Type-Options", "nosniff");
        sanitizedHeaders.set("Content-Type", "application/cbor");
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: sanitizedHeaders,
        });
    }

    if (maybeCanisterId) {
        try {
            const origin = splitHostnameForCanisterId(url.hostname);
            const [agent, actor] = await createAgentAndActor(
                origin ? url.protocol + "//" + origin[1] : url.origin,
                maybeCanisterId,
                shouldFetchRootKey
            );
            const requestHeaders: [string, string][] = [["Host", url.hostname]];
            request.headers.forEach((value, key) => {
                if (key.toLowerCase() === "if-none-match") {
                    // Drop the if-none-match header because we do not want a "304 not modified" response back.
                    // See TT-30.
                    return;
                }
                requestHeaders.push([key, value]);
            });

            // If the accept encoding isn't given, add it because we want to save bandwidth.
            if (!request.headers.has("Accept-Encoding")) {
                requestHeaders.push(["Accept-Encoding", "gzip, deflate, identity"]);
            }

            const httpRequest: HttpRequest = {
                method: request.method,
                url: url.pathname + url.search,
                headers: requestHeaders,
                body: new Uint8Array(await request.arrayBuffer()),
            };

            let upgradeCall = false;
            let httpResponse = await actor.http_request(httpRequest);

            // Redirects are blocked for query calls only: if this response has the upgrade to update call flag set,
            // the update call is allowed to redirect. This is safe because the response (including the headers) will go through consensus.
            if (httpResponse.status_code >= 300 && httpResponse.status_code < 400) {
                console.error(
                    "Due to security reasons redirects are blocked on the IC until further notice!"
                );
                return new Response(
                    "Due to security reasons redirects are blocked on the IC until further notice!",
                    { status: 500 }
                );
            }

            if (httpResponse.upgrade.length === 1 && httpResponse.upgrade[0]) {
                // repeat the request as an update call
                httpResponse = await actor.http_request_update(httpRequest);
                upgradeCall = true;
            }

            const headers = new Headers();

            let certificate: ArrayBuffer | undefined;
            let tree: ArrayBuffer | undefined;
            let encoding = "";
            for (const [key, value] of httpResponse.headers) {
                switch (key.trim().toLowerCase()) {
                    case "ic-certificate":
                        {
                            const fields = value.split(/,/);
                            for (const f of fields) {
                                const [, name, b64Value] = [...f.match(/^(.*)=:(.*):$/)].map((x) =>
                                    x.trim()
                                );
                                const value = base64Arraybuffer.decode(b64Value);

                                if (name === "certificate") {
                                    certificate = value;
                                } else if (name === "tree") {
                                    tree = value;
                                }
                            }
                        }
                        continue;
                    case "content-encoding":
                        encoding = value.trim();
                        break;
                }

                headers.append(key, value);
            }

            // if we do streaming, body contains the first chunk
            let buffer = new ArrayBuffer(0);
            buffer = concat(buffer, httpResponse.body);
            if (httpResponse.streaming_strategy.length !== 0) {
                buffer = concat(
                    buffer,
                    await streamContent(agent, maybeCanisterId, httpResponse.streaming_strategy[0])
                );
            }
            const body = new Uint8Array(buffer);
            const identity = decodeBody(body, encoding);

            // when an update call is used, the response certification is checked by
            // agent-js
            let bodyValid = upgradeCall;
            if (!upgradeCall && certificate && tree) {
                // Try to validate the body as is.
                bodyValid = await validateBody(
                    maybeCanisterId,
                    url.pathname,
                    body.buffer,
                    certificate,
                    tree,
                    agent,
                    shouldFetchRootKey
                );

                if (!bodyValid) {
                    // If that didn't work, try to validate its identity version. This is for
                    // backward compatibility.
                    bodyValid = await validateBody(
                        maybeCanisterId,
                        url.pathname,
                        identity.buffer,
                        certificate,
                        tree,
                        agent,
                        shouldFetchRootKey
                    );
                }
            }
            if (bodyValid) {
                return new Response(identity.buffer, {
                    status: httpResponse.status_code,
                    headers,
                });
            } else {
                console.error("BODY DOES NOT PASS VERIFICATION");
                return new Response("Body does not pass verification", { status: 500 });
            }
        } catch (e) {
            console.error("Failed to fetch response:", e);

            return new Response(`Failed to fetch response: ${String(e)}`, {
                status: 500,
            });
        }
    }

    // Last check. IF this is not part of the same domain, then we simply let it load as is.
    // The same domain will always load using our service worker, and not the same domain
    // would load by reference. If you want security for your users at that point you
    // should use SRI to make sure the resource matches.
    if (!url.hostname.endsWith(swDomains) || url.hostname.endsWith(`raw.${swDomains}`)) {
        console.log("Direct call ...");
        // todo: Do we need to check for headers and certify the content here?
        return await fetch(request);
    }

    console.error(`URL ${JSON.stringify(url.toString())} did not resolve to a canister ID.`);
    return new Response("Could not find the canister ID.", { status: 404 });
}
