import { locale } from "svelte-i18n";
import { get } from "svelte/store";
import { getDecimalSeparator } from "./i18n";
import { parseBigInt } from "openchat-shared";

export function validateTokenInput(value: string, powTenPerWhole: number): ValidatedTokenInput {
    const [replacementText, amount] = validateInput(value, powTenPerWhole);

    return {
        replacementText,
        amount,
    };
}

function validateInput(value: string, powTenPerWhole: number): [string | undefined, bigint] {
    value = value.trim();

    if (value?.length > 0 && value[0] !== "-") {
        const parts = value.split(decimalSeparatorsRegex);
        if (parts.length === 1) {
            const integralString = parts[0];
            const integral = parseBigInt(integralString);

            if (integral !== undefined) {
                return [undefined, integral * BigInt(Math.pow(10, powTenPerWhole))];
            }
        }

        if (parts.length === 2) {
            const integralString = parts[0];
            const integral = parseBigInt(integralString);

            let fractionalString = parts[1];
            let replaceText = false;
            // Trim the string if it exceeds the max number of decimals
            if (fractionalString.length > powTenPerWhole) {
                fractionalString = fractionalString.substr(0, powTenPerWhole);
                replaceText = true;
            }
            const fractional = parseBigInt(fractionalString);

            if (integral !== undefined && fractional !== undefined) {
                const total =
                    integral * BigInt(Math.pow(10, powTenPerWhole)) +
                    fractional * BigInt(Math.pow(10, powTenPerWhole - fractionalString.length));

                return [replaceText ? integralString + "." + fractionalString : undefined, total];
            }
        }
    }

    return ["", BigInt(0)];
}

export function formatTokens(
    amount: bigint,
    powTenPerWhole: number,
    decimalSeparatorOverride?: string,
    fullPrecision = false,
): string {
    if (amount < 0) {
        amount = BigInt(0);
    }
    return format(amount, powTenPerWhole, decimalSeparatorOverride, fullPrecision);
}

function format(
    units: bigint,
    powTenPerWhole: number,
    decimalSeparatorOverride: string | undefined,
    fullPrecision: boolean,
): string {
    // This is a bespoke notion of significant figures!
    const maxSignificantFigures = 6;

    // 1. Always show the full integral part of the number
    // 2. If the integral part >= 6 digits then remove the fractional part
    // 3. Otherwise if there is an integral part the max total number of digits (integral + fractional) = 6
    // 4. If there is no integral part then the max number of significant figures = 6
    // 5. Pad the fractional part with up to 2 '0's trying to keep the total number of digits <= 6

    const unitsPerWhole = BigInt(Math.pow(10, powTenPerWhole));
    const decimalSeparator = decimalSeparatorOverride ?? getDecimalSeparator(get(locale));
    const integral = units / unitsPerWhole;
    const integralString = integral.toString();
    const fractional = units % unitsPerWhole;

    let fractionalString = fractional.toString().padStart(powTenPerWhole, "0");

    if (!fullPrecision) {
        if (integral > 0) {
            const maxFractionalDecimalPlaces = Math.max(
                maxSignificantFigures - integralString.length,
                0,
            );
            if (fractionalString.length > maxFractionalDecimalPlaces) {
                fractionalString = fractionalString.substring(0, maxFractionalDecimalPlaces);
            }
        } else {
            const significantFigures = fractionalString.replace(/^0+/, "").length;
            if (significantFigures > maxSignificantFigures) {
                const indexToRemove =
                    maxSignificantFigures + fractionalString.length - significantFigures;
                fractionalString = fractionalString.substring(0, indexToRemove);
            }
        }
    }

    // Remove trailing zeros leaving 0, 1, or 2 depending on how many integral digits we have already
    const minDecimalPlaces = Math.max(
        0,
        Math.min(2, maxSignificantFigures - integralString.length),
    );

    for (let i = fractionalString.length - 1; i >= minDecimalPlaces; i--) {
        if (fractionalString[i] === "0") {
            fractionalString = fractionalString.slice(0, -1);
        } else {
            break;
        }
    }

    return fractionalString.length > 0
        ? integralString + decimalSeparator + fractionalString
        : integralString;
}

export type ValidatedTokenInput = {
    replacementText: string | undefined;
    amount: bigint;
};

const decimalSeparatorsRegex = /[.,]/;

