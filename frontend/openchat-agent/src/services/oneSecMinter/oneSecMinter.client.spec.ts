import { AnonymousIdentity, HttpAgent } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { ErrorCode } from "@shared";
import { describe, expect, test } from "vitest";
import { OneSecMinterClient } from "./oneSecMinter.client";

const WALLET = Principal.fromText("2vxsx-fae");

function minterResponding(response: unknown) {
    const client = new OneSecMinterClient(
        new AnonymousIdentity(),
        HttpAgent.createSync({ host: "http://localhost" }),
        "5okwm-giaaa-aaaar-qbn6a-cai",
    );
    const calls: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).service = {
        transfer_icp_to_evm: (args: unknown) => {
            calls.push(args);
            return Promise.resolve(response);
        },
    };
    return { client, calls };
}

describe("OneSecMinterClient.transferIcpToEvm", () => {
    test("sends the amount from the wallet to the EVM address", async () => {
        const { client, calls } = minterResponding({ Accepted: { id: 1n } });

        const response = await client.transferIcpToEvm(
            "USDC",
            "Base",
            "0xabc",
            { owner: WALLET },
            5_000_000n,
        );

        expect(response).toEqual({ kind: "success" });
        expect(calls).toEqual([
            {
                token: { USDC: null },
                evm_chain: { Base: null },
                evm_account: { address: "0xabc" },
                icp_account: { ICRC: { owner: WALLET, subaccount: [] } },
                icp_amount: 5_000_000n,
                evm_amount: [],
            },
        ]);
    });

    test("reports a failed transfer", async () => {
        const { client } = minterResponding({ Failed: { error: "amount too low" } });

        const response = await client.transferIcpToEvm(
            "USDT",
            "Ethereum",
            "0xabc",
            { owner: WALLET },
            1n,
        );

        expect(response).toEqual({
            kind: "error",
            code: ErrorCode.TransferFailed,
            message: "amount too low",
        });
    });
});
