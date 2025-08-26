import type { EvmChain } from "./crypto";
import type { Success } from "./response";
import type { OCError } from "./error";

export type OneSecForwardingStatus =
    | {
          kind: "unknown";
      }
    | {
          kind: "checking_balance";
      }
    | {
          kind: "low_balance";
          balance: bigint;
          minAmount: bigint;
      }
    | {
          kind: "forwarding";
      }
    | {
          kind: "forwarded";
          txId: string;
      }
    | {
          kind: "error";
          message: string;
      };

export type OneSecTransferFees = {
    sourceToken: string;
    sourceChain: EvmChain | "ICP";
    destinationToken: string;
    destinationChain: EvmChain | "ICP";
    minAmount: bigint;
    maxAmount: bigint;
    latestTransferFee: bigint;
    protocolFeePercent: number;
};

export type WithdrawViaOneSecResponse = Success | OCError;
