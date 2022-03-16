import { format, validateInput } from "./cryptoFormatter";

describe("crypto formatter", () => {
    describe("validate input", () => {
        test("1 ICP", () => {
            const validated = validateInput("1", 8);
            expect(validated).toEqual(["1", BigInt(100_000_000)]);
        });

        test("1234.567890 ICP", () => {
            const validated = validateInput("1234.567890", 8);
            expect(validated).toEqual(["1234.567890", BigInt(123_456_789_000)]);
        });

        test("0.12345678 ICP", () => {
            const validated = validateInput("0.12345678", 8);
            expect(validated).toEqual(["0.12345678", BigInt(12_345_678)]);
        });

        test("0.123456789 ICP", () => {
            const validated = validateInput("0.123456789", 8);
            expect(validated).toEqual(["0.12345678", BigInt(12_345_678)]);
        });

        test("invalid input", () => {
            const validated = validateInput("abc", 8);
            expect(validated).toEqual(["0", BigInt(0)]);
        });
    });

    describe("format", () => {
        test("1 ICP with min decimals = 4", () => {
            const formatted = format(BigInt(100_000_000), 4, 8);
            expect(formatted).toEqual("1.0000");
        });

        test("1 ICP with min decimals = 0", () => {
            const formatted = format(BigInt(100_000_000), 0, 8);
            expect(formatted).toEqual("1");
        });

        test("1.23456789 ICP with min decimals = 0", () => {
            const formatted = format(BigInt(123_456_789), 0, 8);
            expect(formatted).toEqual("1.23456789");
        });

        test("123456789.12345678 ICP with min decimals = 0", () => {
            const formatted = format(BigInt(12_345_678_912_345_678), 0, 8);
            expect(formatted).toEqual("123456789.12345678");
        });

        test("2.5T cycles with min decimals = 4", () => {
            const formatted = format(BigInt(2_500_000_000_000), 4, 12);
            expect(formatted).toEqual("2.5000");
        });
    });
});
