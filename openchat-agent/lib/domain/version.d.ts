export declare class Version {
    private major;
    private minor;
    private patch;
    constructor(major: number, minor: number, patch: number);
    toText(): string;
    static parse(str: string): Version;
    isGreaterThan(other: Version): boolean;
}
