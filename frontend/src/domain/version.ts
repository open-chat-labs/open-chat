export class Version {
    constructor(private major: number, private minor: number, private patch: number) {}

    public toText(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }

    public static parse(str: string): Version {
        const parts = str.split(".");

        return new Version(Number.parseInt(parts[0]), Number.parseInt(parts[1]), Number.parseInt(parts[2]));
    }

    public isGreaterThan(other: Version): boolean {
        if (this.major > other.major) return true;
        if (this.major < other.major) return false;
        if (this.minor > other.minor) return true;
        if (this.minor < other.minor) return false;
        return this.patch > other.patch;
    }
}
