import { formatICP, validateICPInput } from "./cryptoFormatter";

describe("crypto formatter", () => {
    describe("validate ICP input", () => {
        test("1 ICP", () => {
            const validated = validateICPInput("1");
            expect(validated).toEqual({ replacementText: undefined, e8s: BigInt(100_000_000) });
        });

        test("1234.567890 ICP", () => {
            const validated = validateICPInput("1234.567890");
            expect(validated).toEqual({ replacementText: undefined, e8s: BigInt(123_456_789_000) });
        });

        test("1234,567890 ICP (using comma as decimal separator)", () => {
            const validated = validateICPInput("1234,567890");
            expect(validated).toEqual({ replacementText: undefined, e8s: BigInt(123_456_789_000) });
        });

        test("1,234.567890 ICP (invalid due to command and decimal)", () => {
            const validated = validateICPInput("1,234.567890");
            expect(validated).toEqual({ replacementText: "", e8s: BigInt(0) });
        });

        test("0.12345678 ICP", () => {
            const validated = validateICPInput("0.12345678");
            expect(validated).toEqual({ replacementText: undefined, e8s: BigInt(12_345_678) });
        });

        test("0.123456789 ICP", () => {
            const validated = validateICPInput("0.123456789");
            expect(validated).toEqual({ replacementText: "0.12345678", e8s: BigInt(12_345_678) });
        });

        test("all letters", () => {
            const validated = validateICPInput("abc");
            expect(validated).toEqual({ replacementText: "", e8s: BigInt(0) });
        });

        test("numbers with a letter in the middle", () => {
            const validated = validateICPInput("123a456.789");
            expect(validated).toEqual({ replacementText: "", e8s: BigInt(0) });
        });

        test("negative input", () => {
            const validated = validateICPInput("-123");
            expect(validated).toEqual({ replacementText: "", e8s: BigInt(0) });
        });
    });

    describe("format", () => {
        test("1 ICP with min decimals = 4", () => {
            const formatted = formatICP(BigInt(100_000_000), 4);
            expect(formatted).toEqual("1.0000");
        });

        test("1 ICP with min decimals = 0", () => {
            const formatted = formatICP(BigInt(100_000_000), 0);
            expect(formatted).toEqual("1");
        });

        test("1.23456789 ICP with min decimals = 0", () => {
            const formatted = formatICP(BigInt(123_456_789), 0);
            expect(formatted).toEqual("1.23456789");
        });

        test("123456789.12345678 ICP with min decimals = 2", () => {
            const formatted = formatICP(BigInt(12_345_678_912_345_678), 0);
            expect(formatted).toEqual("123456789.12345678");
        });

        test("123456789.12345678 ICP with comma separator", () => {
            const formatted = formatICP(BigInt(12_345_678_912_345_678), 0, ",");
            expect(formatted).toEqual("123456789,12345678");
        });
    });
});
