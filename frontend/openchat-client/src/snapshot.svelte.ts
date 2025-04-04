export function snapshot<T>(req: T): T {
    return $state.snapshot(req) as T;
}
