import { formatTokens, validateTokenInput } from "./cryptoFormatter";

describe("crypto formatter", () => {
    describe("validate ICP input", () => {
        test("1", () => {
            const validated = validateTokenInput("1", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(100_000_000) });
        });

        test("1234.567890", () => {
            const validated = validateTokenInput("1234.567890", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(123_456_789_000) });
        });

        test("1234,567890 (using comma as decimal separator)", () => {
            const validated = validateTokenInput("1234,567890", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(123_456_789_000) });
        });

        test("1,234.567890 (invalid due to command and decimal)", () => {
            const validated = validateTokenInput("1,234.567890", 8);
            expect(validated).toEqual({ replacementText: "", amount: BigInt(0) });
        });

        test("0.12345678", () => {
            const validated = validateTokenInput("0.12345678", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(12_345_678) });
        });

        test("0.123456789", () => {
            const validated = validateTokenInput("0.123456789", 8);
            expect(validated).toEqual({ replacementText: "0.12345678", amount: BigInt(12_345_678) });
        });

        test("0.", () => {
            const validated = validateTokenInput("0.", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(0) });
        });

        test(".", () => {
            const validated = validateTokenInput(".", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(0) });
        });

        test(".0", () => {
            const validated = validateTokenInput(".0", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(0) });
        });

        test(".000", () => {
            const validated = validateTokenInput(".000", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(0) });
        });

        test("0.0", () => {
            const validated = validateTokenInput("0.0", 8);
            expect(validated).toEqual({ replacementText: undefined, amount: BigInt(0) });
        });

        test("all letters", () => {
            const validated = validateTokenInput("abc", 8);
            expect(validated).toEqual({ replacementText: "", amount: BigInt(0) });
        });

        test("numbers with a letter in the middle", () => {
            const validated = validateTokenInput("123a456.789", 8);
            expect(validated).toEqual({ replacementText: "", amount: BigInt(0) });
        });

        test("negative input", () => {
            const validated = validateTokenInput("-123", 8);
            expect(validated).toEqual({ replacementText: "", amount: BigInt(0) });
        });
    });

    describe("format", () => {
        test("123.456 ICP with comma separator", () => {
            const formatted = formatTokens(BigInt(12_345_600_000), 8, ",");
            expect(formatted).toEqual("123,456");
        });
        
        test("123456789.12345678 ICP formatted as expected", () => {
            const formatted = formatTokens(BigInt(12_345_678_912_345_678), 8, ".");
            expect(formatted).toEqual("123456789");
        });
        
        test("123.456789 ICP formatted as expected", () => {
            const formatted = formatTokens(BigInt(12_345_678_900), 8, ".");
            expect(formatted).toEqual("123.456");
        });
        
        test("0.000123456789000000 ckETH formatted as expected", () => {
            const formatted = formatTokens(BigInt(123_456_789_000_000), 18, ".");
            expect(formatted).toEqual("0.000123456");
        });
        
        test("12345 ICP formatted as expected", () => {
            const formatted = formatTokens(BigInt(1_234_500_000_000), 8, ".");
            expect(formatted).toEqual("12345.0");
        });

        test("1234 ICP formatted as expected", () => {
            const formatted = formatTokens(BigInt(123_400_000_000), 8, ".");
            expect(formatted).toEqual("1234.00");
        });
    });
});
