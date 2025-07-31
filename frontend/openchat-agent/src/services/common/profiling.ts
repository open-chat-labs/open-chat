/* eslint-disable @typescript-eslint/no-explicit-any */

function end<T>(start: number, key: string): (result: T) => T {
    return (result: T) => {
        const end = performance.now();
        const duration = end - start;
        console.log(`${key}: ${duration}ms`);
        return result;
    };
}

export function measure<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return fn().then((res) => {
        const end = performance.now();
        console.log(key, end - start);
        return res;
    });
}

// function inWorker() {
//     return self.WorkerGlobalScope;
// }

export const profile =
    (service: string) =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) => {
        return descriptor;

        // FIXME - we can't access local storage in a worker
        // if (inWorker()) return descriptor;
        // if (!localStorage.getItem("openchat_profile")) return descriptor;
        const originalMethod = descriptor.value;

        descriptor.value = function (...args: any): any {
            const start = performance.now();
            const key = `${service}.${originalMethod.name}`;
            const result = originalMethod.apply(this, args);
            if (result instanceof Promise) {
                return result.then(end(start, key));
            } else {
                return end(start, key)(result);
            }
        };

        return descriptor;
    };
