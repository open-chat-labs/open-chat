import { routeForMessageContext, type ChatIdentifier, type ChatListScope } from "@client";

// The URLs of an open thread (ROUTES.md, "Threads"): `/…/:rootIndex?open=true`, or
// `/…/:rootIndex/:threadIndex` for a reply in it.

/**
 * Where closing the open thread goes: the same page without the thread's reply index
 * (`/:threadIndex`, when the route has one) and without `?open`, keeping the rest of the query
 * (the list of threads' `?threads` among it).
 */
export function threadClosedPath(
    pathname: string,
    search: string,
    threadMessageIndex: number | undefined,
): string {
    const suffix = `/${threadMessageIndex}`;
    const path =
        threadMessageIndex !== undefined && pathname.endsWith(suffix)
            ? pathname.slice(0, -suffix.length)
            : pathname;
    // the other params as they were written (a flag such as ?threads keeps no "=")
    const rest = search
        .replace(/^\?/, "")
        .split("&")
        .filter((param) => param !== "" && param.split("=")[0] !== "open")
        .join("&");
    return rest === "" ? path : `${path}?${rest}`;
}

/**
 * Where opening a thread goes: its root's own path with `?open=true`, keeping the list of
 * threads open (`?threads`) when it's showing.
 */
export function threadOpenPath(
    scope: ChatListScope["kind"],
    chatId: ChatIdentifier,
    threadRootMessageIndex: number,
    search: string,
): string {
    const path = routeForMessageContext(scope, { chatId, threadRootMessageIndex }, true);
    return new URLSearchParams(search).has("threads") ? `${path}&threads` : path;
}
