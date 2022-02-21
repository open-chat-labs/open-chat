// This is borrowed from Elm. Quite a useful idea.

export type Idle = { kind: "idle" };
export type Loading = { kind: "loading" };
export type Error<E> = {
    kind: "error";
    error: E;
};
export type Success<T> = {
    kind: "success";
    data: T;
};
export type RemoteData<T, E> = Idle | Loading | Error<E> | Success<T>;

export function mapRemoteData<T, E>(
    remote: RemoteData<T, E>,
    mapFn: (data: T) => T
): RemoteData<T, E> {
    if (remote.kind === "success") {
        return {
            kind: "success",
            data: mapFn(remote.data),
        };
    }
    return remote;
}
