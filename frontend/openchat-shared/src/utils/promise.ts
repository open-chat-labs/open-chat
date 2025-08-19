export type WaitAllResult<T> = {
    success: T[];
    errors: unknown[];
};

export async function waitAll<T>(promises: Promise<T>[]): Promise<WaitAllResult<T>> {
    const results = await Promise.allSettled(promises);

    const success: T[] = [];
    const errors = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            success.push(result.value);
        } else {
            errors.push(result.reason);
        }
    }

    return {
        success,
        errors,
    };
}

const promisesMap = new Map<string, Promise<unknown>>();

export async function getOrStartPromise<T>(func: () => Promise<T>, id: string): Promise<T> {
    const existing = promisesMap.get(id);
    if (existing !== undefined) return existing as Promise<T>;

    const promise = func();
    promisesMap.set(id, promise);

    try {
        return await promise;
    } finally {
        promisesMap.delete(id);
    }
}
