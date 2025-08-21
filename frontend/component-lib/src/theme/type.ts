import type { Colours } from "./colour";

export class Theme {
    constructor(public colours: Colours) {}

    writeCssVariables() {
        const colours = this.colours.cssVariables();
        colours.forEach((cssVar) => {
            cssVar.write();
        });
    }
}
