export class Version {
    constructor(private major: number, private minor: number, private patch: number) {}

    toText(): string {
        return `${this.major}.${this.minor}.${this.patch}`;
    }
}