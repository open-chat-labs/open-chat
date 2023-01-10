export type WaitAllResult<T> = {
    success: T[],
    errors: unknown[],
}

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
    }
}
