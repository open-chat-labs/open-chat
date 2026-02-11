export type Fraction = number & { readonly __brand: "Fraction" };

// Ensures fractions are properly provided!
export function fraction(value: number): Fraction {
    if (value < 0 || value > 1) {
        throw new Error("Fraction must be between 0 and 1");
    }
    return value as Fraction;
}
