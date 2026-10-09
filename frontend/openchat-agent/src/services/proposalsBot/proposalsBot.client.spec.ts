import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { ProposalsBotClient } from "./proposalsBot.client";

const PROPOSALS_BOT = "rno2w-sqaaa-aaaaa-aaacq-cai";
const GOVERNANCE = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const WALLET = Principal.selfAuthenticating(new Uint8Array(32).fill(7)).toText();
const CREATED = 1_791_564_840_000_000_000n;

describe("ProposalsBotClient.submitProposal", () => {
    test("the fee is pulled from the wallet it is given into the ProposalsBot's own account, stamped as given", async () => {
        const sent: [string, unknown][] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Object.create(ProposalsBotClient.prototype) as any;
        client.canisterId = PROPOSALS_BOT;
        client.update = (method: string, args: unknown) => {
            sent.push([method, args]);
            return Promise.resolve({ kind: "success" });
        };

        await client.submitProposal(
            WALLET,
            GOVERNANCE,
            { title: "title", url: undefined, summary: "summary", action: { kind: "motion" } },
            LEDGER,
            "ICP",
            1_000n,
            10n,
            CREATED,
        );

        expect(sent.length).toEqual(1);
        const [method, args] = sent[0];
        expect(method).toEqual("submit_proposal");
        expect(args).toMatchObject({
            transaction: {
                amount: 1_010n,
                fee: 10n,
                from: {
                    owner: Principal.fromText(WALLET).toUint8Array(),
                    subaccount: undefined,
                },
                to: {
                    owner: Principal.fromText(PROPOSALS_BOT).toUint8Array(),
                    subaccount: undefined,
                },
                created: CREATED,
            },
        });
    });
});
