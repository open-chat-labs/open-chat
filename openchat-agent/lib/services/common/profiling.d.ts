export declare function showTrace(): boolean;
export declare function measure<T>(key: string, fn: () => Promise<T>): Promise<T>;
export declare const profile: (service: string) => (_target: Object, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
