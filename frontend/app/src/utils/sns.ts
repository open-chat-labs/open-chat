import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";

export const OC_GOVERNANCE_CANISTER_ID = "2jvtu-yqaaa-aaaaq-aaama-cai";

export function createAddTokenPayload(
    ledgerCanisterId: string,
    infoUrl: string,
    howToBuyUrl: string,
    transactionUrlFormat: string,
    logo: string | undefined,
): Uint8Array {
    return new Uint8Array(
        IDL.encode(
            [
                IDL.Record({
                    how_to_buy_url: IDL.Text,
                    info_url: IDL.Text,
                    logo: IDL.Opt(IDL.Text),
                    token_standard: IDL.Variant({ icrc1: IDL.Null }),
                    ledger_canister_id: IDL.Principal,
                    transaction_url_format: IDL.Text,
                }),
            ],
            [
                {
                    how_to_buy_url: howToBuyUrl,
                    info_url: infoUrl,
                    logo: optionalStringToCandid(logo),
                    token_standard: { icrc1: null },
                    ledger_canister_id: Principal.fromText(ledgerCanisterId),
                    transaction_url_format: transactionUrlFormat,
                },
            ],
        ),
    );
}

export function createUpdateTokenPayload(
    ledgerCanisterId: string,
    name: string | undefined,
    symbol: string | undefined,
    infoUrl: string | undefined,
    howToBuyUrl: string | undefined,
    transactionUrlFormat: string | undefined,
    logo: string | undefined,
): Uint8Array {
    return new Uint8Array(
        IDL.encode(
            [
                IDL.Record({
                    how_to_buy_url: IDL.Opt(IDL.Text),
                    info_url: IDL.Opt(IDL.Text),
                    logo: IDL.Opt(IDL.Text),
                    name: IDL.Opt(IDL.Text),
                    ledger_canister_id: IDL.Principal,
                    symbol: IDL.Opt(IDL.Text),
                    transaction_url_format: IDL.Opt(IDL.Text),
                }),
            ],
            [
                {
                    how_to_buy_url: optionalStringToCandid(howToBuyUrl),
                    info_url: optionalStringToCandid(infoUrl),
                    logo: optionalStringToCandid(logo),
                    name: optionalStringToCandid(name),
                    ledger_canister_id: Principal.fromText(ledgerCanisterId),
                    symbol: optionalStringToCandid(symbol),
                    transaction_url_format: optionalStringToCandid(transactionUrlFormat),
                },
            ],
        ),
    );
}

function optionalStringToCandid(value: string | undefined): [string] | [] {
    return value !== undefined && value.length > 0 ? [value] : [];
}
