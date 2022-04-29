/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { profileStore } from "../../stores/profiling";

export function showTrace() {
    return localStorage.getItem("openchat_profile") === "true";
}

function end<T>(start: number, key: string): (result: T) => T {
    return (result: T) => {
        const end = performance.now();
        const duration = end - start;
        console.log(`${key}: ${duration}ms`);
        profileStore.capture(key, duration);
        return result;
    };
}

export const profile =
    (service: string) =>
    (_target: Object, _propertyKey: string, descriptor: PropertyDescriptor) => {
        if (!localStorage.getItem("openchat_profile")) return descriptor;
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
