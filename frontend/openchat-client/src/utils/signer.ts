import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import type { IDL } from "@icp-sdk/core/candid";
import type { Principal } from "@icp-sdk/core/principal";
import { Signer, type PermissionScope, type PermissionState } from "@icp-sdk/signer";
import { SignerAgent } from "@icp-sdk/signer/agent";
import { PostMessageTransport } from "@icp-sdk/signer/web";
import { encodeIcrcAccount, isMainnet, type IcrcAccount } from "@shared";

export type SignerWalletId = "oisy" | "nfid";

export type SignerWallet = {
    id: SignerWalletId;
    name: string;
    // The wallet's ICRC-29 signer endpoint, opened in a popup which the ICRC-25 messages are
    // exchanged with
    signerUrl: string;
    // The wallet's brand mark, served from the app's own assets
    logo: string;
};

// Any wallet implementing ICRC-25/27/29/49 works here - these are just the ones we surface. The
// endpoints and logos are the ones each wallet publishes via NFID's identitykit.
export const SIGNER_WALLETS: SignerWallet[] = [
    { id: "oisy", name: "OISY", signerUrl: "https://signer.oisy.com", logo: "/assets/wallets/oisy.svg" },
    { id: "nfid", name: "NFID", signerUrl: "https://nfid.one/rpc", logo: "/assets/wallets/nfid.svg" },
];

// Listing the wallet's accounts and asking it to sign a canister call are the only two things we
// ever need it to do
const REQUIRED_SCOPES: PermissionScope[] = [
    { method: "icrc27_accounts" },
    { method: "icrc49_call_canister" },
];

// How long an approval we request stays spendable. The allowance is the whole of the access the
// user grants us, so it should outlive the payment it is for and nothing more - an approval left
// standing is one we could spend at any point later.
export const APPROVAL_VALIDITY_MS = 10 * 60 * 1000;

const NANOS_PER_MILLISECOND = 1_000_000n;

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
    // Nanos since epoch, defaulting to `APPROVAL_VALIDITY_MS` from now
    expiresAt?: bigint;
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
        private readonly agent: HttpAgent | undefined,
    ) {}

    // Opens the wallet in a popup and asks for permission to list accounts and request canister
    // calls. Must be called from a user gesture or the popup will be blocked.
    static async connect(wallet: SignerWallet, icUrl: string): Promise<SignerConnection> {
        const transport = new PostMessageTransport({ url: wallet.signerUrl });
        // The popup can only be opened from within a click, so the channel has to stay open for
        // the calls which follow rather than being reopened per request.
        const signer = new Signer({ transport, autoCloseTransportChannel: false });
        try {
            // Nothing may be awaited before this: the popup is opened by the first request sent,
            // and a signer window opened outside the click which triggered it is rejected.
            const permissions = await signer.requestPermissions(REQUIRED_SCOPES);
            const missing = missingScopes(REQUIRED_SCOPES, permissions);
            if (missing.length > 0) {
                throw new Error(`Wallet did not grant permissions: ${missing.join(", ")}`);
            }
            return new SignerConnection(wallet, signer, await createVerifyingAgent(icUrl));
        } catch (err) {
            await signer.closeChannel();
            throw err;
        }
    }

    async accounts(): Promise<WalletAccount[]> {
        const accounts = await this.signer.getAccounts();
        return accounts.map((account) => ({ ...account, address: encodeIcrcAccount(account) }));
    }

    // Asks the wallet to grant the spender an allowance by calling `icrc2_approve` on the ledger.
    // The wallet shows the user the ledger's consent message (ICRC-21) before signing. Returns the
    // ledger block index of the approval.
    async approveSpending(args: ApproveSpendingArgs): Promise<bigint> {
        const agent = SignerAgent.createSync({
            signer: this.signer,
            account: args.account.owner,
            agent: this.agent,
        });
        const ledger = Actor.createActor<ApproveService>(approveIdlFactory, {
            agent,
            canisterId: args.ledger,
        });
        const result = await ledger.icrc2_approve(buildApproveArgs(args));
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

type ApproveService = {
    icrc2_approve: (args: CandidApproveArgs) => Promise<ApproveResult>;
};

// The scopes we asked for which the wallet is not letting us use. ICRC-25 answers with the scopes
// it is granting, so one we asked for being absent is a refusal just as much as one returned as
// denied. `ask_on_use` is a grant - the wallet prompts the user when we call rather than now.
export function missingScopes(
    required: PermissionScope[],
    granted: { scope: PermissionScope; state: PermissionState }[],
): string[] {
    return required
        .map((scope) => scope.method)
        .filter((method) => {
            const match = granted.find((p) => p.scope.method === method);
            return match === undefined || match.state === "denied";
        });
}

// Approvals are only accepted once their certificate verifies, which needs the root key of
// whichever network we are pointed at. Mainnet's is built in; anything else has to fetch it, or
// every approval fails as though it had been tampered with.
async function createVerifyingAgent(icUrl: string): Promise<HttpAgent | undefined> {
    if (isMainnet(icUrl)) return undefined;

    const agent = HttpAgent.createSync({ host: icUrl });
    await agent.fetchRootKey();
    return agent;
}

function formatErrorDetail(detail: unknown): string {
    if (detail === null || detail === undefined) return "";
    return JSON.stringify(detail, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
    );
}

export function buildApproveArgs(
    { account, amount, spender, expiresAt }: ApproveSpendingArgs,
    now: number = Date.now(),
): CandidApproveArgs {
    return {
        from_subaccount: account.subaccount !== undefined ? [account.subaccount] : [],
        spender: {
            owner: spender.owner,
            subaccount: spender.subaccount !== undefined ? [spender.subaccount] : [],
        },
        amount,
        expected_allowance: [],
        expires_at: [expiresAt ?? BigInt(now + APPROVAL_VALIDITY_MS) * NANOS_PER_MILLISECOND],
        fee: [],
        memo: [],
        created_at_time: [],
    };
}

const approveIdlFactory: IDL.InterfaceFactory = ({ IDL }) => {
    const ApproveArgs = IDL.Record({
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
    const ApproveError = IDL.Variant({
        BadFee: IDL.Record({ expected_fee: IDL.Nat }),
        InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
        AllowanceChanged: IDL.Record({ current_allowance: IDL.Nat }),
        Expired: IDL.Record({ ledger_time: IDL.Nat64 }),
        TooOld: IDL.Null,
        CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
        Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
        TemporarilyUnavailable: IDL.Null,
        GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
    });
    return IDL.Service({
        icrc2_approve: IDL.Func(
            [ApproveArgs],
            [IDL.Variant({ Ok: IDL.Nat, Err: ApproveError })],
            [],
        ),
    });
};

export type ExternalWalletApproval = {
    wallet: SignerWallet;
    ledger: string;
    // What the payment will pull, plus the fee the ledger burns moving it. The allowance has to
    // cover both or `icrc2_transfer_from` fails once we come to spend it.
    amount: bigint;
    spender: IcrcAccount;
};

// Connects to the wallet, settles on the account to pay from and has the wallet approve the spend,
// returning that account for the caller to pass on as `fromAccount`. Returns undefined if the user
// backs out without choosing an account.
//
// Must be called synchronously from a click handler - see `SignerConnection.connect`. Choosing an
// account may await the user, which is fine: only opening the channel is tied to the click.
export async function approveFromExternalWallet(
    { wallet, ledger, amount, spender }: ExternalWalletApproval,
    icUrl: string,
    chooseAccount: (accounts: WalletAccount[]) => Promise<WalletAccount | undefined>,
    // Called once the wallet is showing the user the approval to sign, which is where the flow
    // spends most of its time
    onApproving?: () => void,
): Promise<string | undefined> {
    const connection = await SignerConnection.connect(wallet, icUrl);
    try {
        const accounts = await connection.accounts();
        // A wallet which grants the scope and then names no accounts leaves nothing to pay from,
        // and asking the user to choose from an empty list would strand the flow
        if (accounts.length === 0) {
            throw new Error(`${wallet.name} did not return an account to pay from`);
        }

        const account = accounts.length === 1 ? accounts[0] : await chooseAccount(accounts);
        if (account === undefined) return undefined;

        onApproving?.();
        await connection.approveSpending({ account, ledger, amount, spender });
        return account.address;
    } finally {
        // The popup is the user's window onto their wallet, so it closes with the flow whether or
        // not the approval went through
        await connection.disconnect();
    }
}
