/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

function end<T>(key: string): (result: T) => T {
    return (result: T) => {
        console.timeEnd(key);
        return result;
    };
}

export const profile =
    (service: string) =>
    (_target: Object, _propertyKey: string, descriptor: PropertyDescriptor) => {
        if (!localStorage.getItem("openchat_profile")) return descriptor;

        const originalMethod = descriptor.value;
        const key = `${service}.${originalMethod.name}`;

        descriptor.value = function (...args: any): any {
            console.time(key);
            const result = originalMethod.apply(this, args);
            if (result instanceof Promise) {
                return result.then(end(key));
            } else {
                return end(key)(result);
            }
        };

        return descriptor;
    };
