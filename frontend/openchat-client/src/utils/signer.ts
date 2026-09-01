import { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";
import {
    Signer,
    createAccountsPermissionScope,
    createCallCanisterPermissionScope,
} from "@slide-computer/signer";
import { SignerAgent } from "@slide-computer/signer-agent";
import { PostMessageTransport } from "@slide-computer/signer-web";
import { encodeIcrcAccount, type IcrcAccount } from "@shared";

export type SignerWalletId = "oisy" | "nfid";

export type SignerWallet = {
    id: SignerWalletId;
    name: string;
    // The wallet's ICRC-29 signer endpoint, opened in a popup which the ICRC-25 messages are
    // exchanged with
    signerUrl: string;
};

// Any wallet implementing ICRC-25/27/29/49 works here - these are just the ones we surface
export const SIGNER_WALLETS: SignerWallet[] = [
    { id: "oisy", name: "OISY", signerUrl: "https://oisy.com/sign" },
    { id: "nfid", name: "NFID", signerUrl: "https://nfid.one/rpc" },
];

export type WalletAccount = IcrcAccount & {
    // The textual encoding of the account, which is what the rest of OpenChat passes around as
    // `fromAccount`
    address: string;
};

export type ApproveSpendingArgs = {
    account: WalletAccount;
    ledger: string;
    // Must cover the amount later pulled via `icrc2_transfer_from` plus the fee that transfer
    // burns - the ledger checks the allowance against amount + fee
    amount: bigint;
    spender: IcrcAccount;
    expiresAt?: bigint; // nanos since epoch
};

export class ApproveError extends Error {
    constructor(
        public readonly kind: string,
        detail: string,
    ) {
        super(`Approval failed: ${kind}${detail.length > 0 ? ` ${detail}` : ""}`);
    }
}

// A connection to an external wallet ("signer") via the ICRC-25 signer protocol. The wallet keeps
// its keys throughout - we only ever ask it to show the user a request and sign the result - so
// this is the full extent of the access OpenChat gets.
export class SignerConnection {
    private constructor(
        readonly wallet: SignerWallet,
        private readonly signer: Signer,
    ) {}

    // Opens the wallet in a popup and asks for permission to list accounts and request canister
    // calls. Must be called from a user gesture or the popup will be blocked.
    static async connect(wallet: SignerWallet): Promise<SignerConnection> {
        const transport = new PostMessageTransport({ url: wallet.signerUrl });
        const signer = new Signer({ transport });
        const permissions = await signer.requestPermissions([
            createAccountsPermissionScope(),
            createCallCanisterPermissionScope(),
        ]);
        const denied = permissions.filter((p) => p.state === "denied").map((p) => p.scope.method);
        if (denied.length > 0) {
            await signer.closeChannel();
            throw new Error(`Wallet denied permissions: ${denied.join(", ")}`);
        }
        return new SignerConnection(wallet, signer);
    }

    async accounts(): Promise<WalletAccount[]> {
        const accounts = await this.signer.accounts();
        return accounts.map((account) => ({ ...account, address: encodeIcrcAccount(account) }));
    }

    // Asks the wallet to grant the spender an allowance by calling `icrc2_approve` on the ledger.
    // The wallet shows the user the ledger's consent message (ICRC-21) before signing. Returns the
    // ledger block index of the approval.
    async approveSpending(args: ApproveSpendingArgs): Promise<bigint> {
        const agent = SignerAgent.createSync({
            signer: this.signer,
            account: args.account.owner,
        });
        // SignerAgent's `query` sends the request as a real (update) call through the signer,
        // validates that the signed content matches what we asked for and that the certificate is
        // genuine, and hands back the reply. We go through it rather than an Actor because Actor
        // now drives calls via `Agent.update`, which SignerAgent does not implement yet.
        const response = await agent.query(Principal.fromText(args.ledger), {
            methodName: "icrc2_approve",
            arg: new Uint8Array(IDL.encode([ApproveArgsIdl], [buildApproveArgs(args)])),
        });
        if (response.status !== "replied") {
            throw new ApproveError("Rejected", formatErrorDetail(response));
        }
        const [result] = IDL.decode([ApproveResultIdl], response.reply.arg) as [ApproveResult];
        if ("Err" in result) {
            const [kind, detail] = Object.entries(result.Err)[0] ?? ["Unknown", null];
            throw new ApproveError(kind, formatErrorDetail(detail));
        }
        return result.Ok;
    }

    async disconnect(): Promise<void> {
        await this.signer.closeChannel();
    }
}

type CandidApproveArgs = {
    from_subaccount: [] | [Uint8Array];
    spender: { owner: Principal; subaccount: [] | [Uint8Array] };
    amount: bigint;
    expected_allowance: [] | [bigint];
    expires_at: [] | [bigint];
    fee: [] | [bigint];
    memo: [] | [Uint8Array];
    created_at_time: [] | [bigint];
};

type ApproveResult = { Ok: bigint } | { Err: Record<string, unknown> };

function formatErrorDetail(detail: unknown): string {
    if (detail === null || detail === undefined) return "";
    return JSON.stringify(detail, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
    );
}

export function buildApproveArgs({
    account,
    amount,
    spender,
    expiresAt,
}: ApproveSpendingArgs): CandidApproveArgs {
    return {
        from_subaccount: account.subaccount !== undefined ? [account.subaccount] : [],
        spender: {
            owner: spender.owner,
            subaccount: spender.subaccount !== undefined ? [spender.subaccount] : [],
        },
        amount,
        expected_allowance: [],
        expires_at: expiresAt !== undefined ? [expiresAt] : [],
        fee: [],
        memo: [],
        created_at_time: [],
    };
}

const ApproveArgsIdl = IDL.Record({
    from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    spender: IDL.Record({
        owner: IDL.Principal,
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    }),
    amount: IDL.Nat,
    expected_allowance: IDL.Opt(IDL.Nat),
    expires_at: IDL.Opt(IDL.Nat64),
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
});

const ApproveResultIdl = IDL.Variant({
    Ok: IDL.Nat,
    Err: IDL.Variant({
        BadFee: IDL.Record({ expected_fee: IDL.Nat }),
        InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
        AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
        Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
        TooOld: IDL.Null,
        CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
        Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
        TemporarilyUnavailable: IDL.Null,
        GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
    }),
});
