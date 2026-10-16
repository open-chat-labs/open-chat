import { linkFonts } from "./fonts";

const appFonts = "https://fonts.googleapis.com/css2?family=Manrope&display=swap";
const webFonts = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans&display=swap";

function stylesheets(): string[] {
    return [...document.head.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet]")].map(
        (l) => l.href,
    );
}

describe("linkFonts", () => {
    afterEach(() => {
        document.head.innerHTML = "";
    });

    test("links the mounted tree's fonts", () => {
        linkFonts(webFonts);
        expect(stylesheets()).toEqual([webFonts]);
    });

    test("doesn't link them twice when index.html already has", () => {
        document.head.innerHTML = `<link rel="stylesheet" href="${webFonts}" />`;
        linkFonts(webFonts);
        expect(stylesheets()).toEqual([webFonts]);
    });

    test("links them anyway when index.html guessed the other tree", () => {
        document.head.innerHTML = `<link rel="stylesheet" href="${appFonts}" />`;
        linkFonts(webFonts);
        expect(stylesheets()).toEqual([appFonts, webFonts]);
    });
});
