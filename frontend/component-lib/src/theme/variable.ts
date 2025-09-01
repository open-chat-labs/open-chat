export class CssVariable {
    constructor(
        private name: string,
        private value: string,
    ) {}
    write() {
        document.documentElement.style.setProperty(`--${this.name}`, this.value);
    }

    static zero(name: string) {
        return new CssVariable(`${name}-zero`, "0");
    }
}
