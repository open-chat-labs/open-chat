import { e8sAmount, principalProblem, thresholdProblem, wholeNumberProblem } from "./fieldChecks";

const PRINCIPAL = "rdmx6-jaaaa-aaaaa-aaadq-cai";

describe("the console's field checks", () => {
    test("take a principal, a list of them, or nothing", () => {
        expect(principalProblem("")).toBeUndefined();
        expect(principalProblem(PRINCIPAL)).toBeUndefined();
        expect(principalProblem("not-a-principal")).toMatch(/Not a valid principal/);
        expect(principalProblem(`${PRINCIPAL}, ,${PRINCIPAL}`, true)).toBeUndefined();
        expect(principalProblem(`${PRINCIPAL}, nope`, true)).toBe(
            '"nope" is not a valid principal',
        );
    });

    test("take a whole number, or nothing", () => {
        expect(wholeNumberProblem("")).toBeUndefined();
        expect(wholeNumberProblem(" 12 ")).toBeUndefined();
        expect(wholeNumberProblem("1.5")).toBe("A whole number");
    });

    test("take a threshold from 0 to 1, blank turning it off", () => {
        expect(thresholdProblem("")).toBeUndefined();
        expect(thresholdProblem("0.82")).toBeUndefined();
        expect(thresholdProblem("1.4")).toBe("From 0 to 1");
        expect(thresholdProblem("x")).toBe("From 0 to 1");
    });

    test("say what an e8s amount comes to", () => {
        expect(e8sAmount("1500000000", "CHAT")).toBe("15.00 CHAT");
        expect(e8sAmount("", "CHAT")).toBeUndefined();
        expect(e8sAmount("1.5", "ICP")).toBeUndefined();
    });
});
