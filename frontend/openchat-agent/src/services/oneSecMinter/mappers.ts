import type {
    ApiChain,
    ApiEvmChain,
    ApiForwardEvmToIcpArg,
    ApiForwardingResponse,
    ApiToken,
    ApiTransferFee,
} from "./candid/idl";
import {
    ARBITRUM_NETWORK,
    BASE_NETWORK,
    type Chain,
    ETHEREUM_NETWORK,
    type EvmChain,
    ICP_SYMBOL,
    type OneSecForwardingStatus,
    type OneSecTransferFees,
    UnsupportedValueError,
    USDC_SYMBOL,
    USDT_SYMBOL,
} from "openchat-shared";
import { identity, optional } from "../../utils/mapping";
import { Principal } from "@dfinity/principal";

export function forwardingResponse(
    candid: { Ok: ApiForwardingResponse } | { Err: string },
): OneSecForwardingStatus {
    if ("Ok" in candid) {
        const status = optional(candid.Ok.status, identity);
        if (status !== undefined) {
            if ("CheckingBalance" in status) {
                return { kind: "checking_balance" };
            } else if ("LowBalance" in status) {
                return {
                    kind: "low_balance",
                    balance: status.LowBalance.balance,
                    minAmount: status.LowBalance.min_amount,
                };
            } else if ("Forwarding" in status) {
                return { kind: "forwarding" };
            } else if ("Forwarded" in status) {
                return {
                    kind: "forwarded",
                    txId: status.Forwarded.hash,
                };
            }
        }
    }
    if ("Err" in candid) {
        return {
            kind: "error",
            message: candid.Err,
        };
    }
    return { kind: "unknown" };
}

export function apiForwardEvmToIcpArgs(
    tokenSymbol: string,
    chain: EvmChain,
    address: string,
    receiver: string,
): ApiForwardEvmToIcpArg {
    return {
        token: apiToken(tokenSymbol),
        chain: apiEvmChain(chain),
        address,
        receiver: {
            ICRC: {
                owner: Principal.fromText(receiver),
                subaccount: [] as [],
            },
        },
    };
}

export function transferFeesResponse(candid: ApiTransferFee[]): OneSecTransferFees[] {
    return candid.reduce((arr, next) => {
        const fees = transferFees(next);
        if (fees !== undefined) {
            arr.push(fees);
        }
        return arr;
    }, [] as OneSecTransferFees[]);
}

function transferFees(candid: ApiTransferFee): OneSecTransferFees | undefined {
    const sourceToken = optional(candid.source_token, token);
    const sourceChain = optional(candid.source_chain, chain);
    const destinationToken = optional(candid.destination_token, token);
    const destinationChain = optional(candid.destination_chain, chain);

    if (
        sourceToken === undefined ||
        sourceChain === undefined ||
        destinationToken === undefined ||
        destinationChain === undefined
    ) {
        return undefined;
    }

    return {
        sourceToken,
        sourceChain,
        destinationToken,
        destinationChain,
        minAmount: candid.min_amount,
        maxAmount: candid.max_amount,
        latestTransferFee: candid.latest_transfer_fee_in_tokens,
        protocolFeePercent: candid.protocol_fee_in_percent * 100,
    };
}

export function apiToken(token: string): ApiToken {
    switch (token.toLowerCase()) {
        case "USDC":
            return { USDC: null };
        case "USDT":
            return { USDT: null };
        default:
            throw new Error("Token not supported: " + token);
    }
}

function token(candid: ApiToken): string | undefined {
    if ("ICP" in candid) return ICP_SYMBOL;
    if ("USDC" in candid) return USDC_SYMBOL;
    if ("USDT" in candid) return USDT_SYMBOL;
    return undefined;
}

function chain(candid: ApiChain): Chain {
    if ("ICP" in candid) return ICP_SYMBOL;
    if ("Ethereum" in candid) return ETHEREUM_NETWORK;
    if ("Arbitrum" in candid) return ARBITRUM_NETWORK;
    if ("Base" in candid) return BASE_NETWORK;
    throw new UnsupportedValueError("Unexpected chain", candid);
}

function apiEvmChain(evmChain: EvmChain): ApiEvmChain {
    switch (evmChain) {
        case ETHEREUM_NETWORK:
            return { Ethereum: null };
        case ARBITRUM_NETWORK:
            return { Arbitrum: null };
        case BASE_NETWORK:
            return { Base: null };
        default:
            throw new UnsupportedValueError("Unsupported EvmChain", evmChain);
    }
}
