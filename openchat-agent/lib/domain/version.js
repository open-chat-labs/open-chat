export class Version {
    constructor(major, minor, patch) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }
    toText() {
        return `${this.major}.${this.minor}.${this.patch}`;
    }
    static parse(str) {
        const parts = str.split(".");
        return new Version(Number.parseInt(parts[0]), Number.parseInt(parts[1]), Number.parseInt(parts[2]));
    }
    isGreaterThan(other) {
        if (this.major > other.major)
            return true;
        if (this.major < other.major)
            return false;
        if (this.minor > other.minor)
            return true;
        if (this.minor < other.minor)
            return false;
        return this.patch > other.patch;
    }
}
//# sourceMappingURL=version.js.map