import { locale } from "svelte-i18n";
import { get } from "svelte/store";
import { getDecimalSeparator } from "./i18n";

export function validateTokenInput(value: string): ValidatedICPInput {
    const [replacementText, e8s] = validateInput(value, 8);

    return {
        replacementText,
        e8s,
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

function parseBigInt(value: string): bigint | undefined {
    if (value.length === 0) return BigInt(0);
    return integerRegex.test(value) ? BigInt(value) : undefined;
}

export function formatTokens(
    e8s: bigint,
    minDecimals: number,
    decimalSeparatorOverride?: string
): string {
    return format(e8s, minDecimals, 8, decimalSeparatorOverride);
}

function format(
    units: bigint,
    minDecimals: number,
    powTenPerWhole: number,
    decimalSeparatorOverride?: string
): string {
    const unitsPerWhole = BigInt(Math.pow(10, powTenPerWhole));
    const decimalSeparator = decimalSeparatorOverride ?? getDecimalSeparator(get(locale));
    const integral = units / unitsPerWhole;
    const integralString = integral.toString();

    const fractional = units % unitsPerWhole;
    let fractionalString = fractional.toString().padStart(powTenPerWhole, "0");

    let countToTrim = 0;
    while (
        fractionalString.length - countToTrim > minDecimals &&
        fractionalString[fractionalString.length - 1 - countToTrim] === "0"
    ) {
        countToTrim++;
    }

    if (countToTrim > 0) {
        fractionalString = fractionalString.substr(0, fractionalString.length - countToTrim);
    }

    return fractionalString.length > 0
        ? integralString + decimalSeparator + fractionalString
        : integralString;
}

export type ValidatedICPInput = {
    replacementText: string | undefined;
    e8s: bigint;
};

const decimalSeparatorsRegex = /[.,]/;
const integerRegex = /^[0-9]+$/;
