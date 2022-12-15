export type WaitAllResult<T, E> = {
    success: T[],
    errors: E[]
}

export async function waitAll<T, E>(promises: Promise<T>[]): Promise<WaitAllResult<T, E>> {
    const results = await Promise.allSettled(promises);

    const success: T[] = [];
    const errors: E[] = [];
    for (const result of results) {
        if (result.status === "fulfilled") {
            success.push(result.value);
        } else {
            errors.push(result.reason as E);
        }
    }

    return {
        success,
        errors,
    }
}
