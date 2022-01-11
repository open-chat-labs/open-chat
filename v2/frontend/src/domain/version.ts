export class Version {
    major : number;
    minor : number;
    patch : number;
  
    constructor(major: number, minor: number, patch: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    toText(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }
}
