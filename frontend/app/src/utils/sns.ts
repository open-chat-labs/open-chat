import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import type { CandidateExternalBot } from "openchat-client";

export const OC_GOVERNANCE_CANISTER_ID = "2jvtu-yqaaa-aaaaq-aaama-cai";

export function createAddTokenPayload(
    ledgerCanisterId: string,
    userId: string,
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
                    payer: IDL.Opt(IDL.Principal),
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
                    payer: [Principal.fromText(userId)],
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

const GroupPermission = IDL.Variant({
    StartVideoCall: IDL.Null,
    DeleteMessages: IDL.Null,
    RemoveMembers: IDL.Null,
    UpdateGroup: IDL.Null,
    ReactToMessages: IDL.Null,
    AddMembers: IDL.Null,
    InviteUsers: IDL.Null,
    MentionAllMembers: IDL.Null,
    PinMessages: IDL.Null,
    ChangeRoles: IDL.Null,
});
const CommunityPermission = IDL.Variant({
    RemoveMembers: IDL.Null,
    CreatePublicChannel: IDL.Null,
    InviteUsers: IDL.Null,
    ManageUserGroups: IDL.Null,
    UpdateDetails: IDL.Null,
    CreatePrivateChannel: IDL.Null,
    ChangeRoles: IDL.Null,
});
const MessagePermission = IDL.Variant({
    VideoCall: IDL.Null,
    Giphy: IDL.Null,
    File: IDL.Null,
    Poll: IDL.Null,
    Text: IDL.Null,
    Image: IDL.Null,
    Prize: IDL.Null,
    P2pSwap: IDL.Null,
    Audio: IDL.Null,
    Crypto: IDL.Null,
    Video: IDL.Null,
});
const SlashCommandPermissions = IDL.Record({
    chat: IDL.Vec(GroupPermission),
    community: IDL.Vec(CommunityPermission),
    thread: IDL.Vec(MessagePermission),
    message: IDL.Vec(MessagePermission),
});
const NumberParamChoice = IDL.Record({
    value: IDL.Nat16,
    name: IDL.Text,
});
const NumberParam = IDL.Record({
    min_length: IDL.Nat16,
    max_length: IDL.Nat16,
    choices: IDL.Vec(NumberParamChoice),
});
const StringParamChoice = IDL.Record({
    value: IDL.Text,
    name: IDL.Text,
});
const StringParam = IDL.Record({
    min_length: IDL.Nat16,
    max_length: IDL.Nat16,
    choices: IDL.Vec(StringParamChoice),
});
const SlashCommandParamType = IDL.Variant({
    UserParam: IDL.Null,
    NumberParam: NumberParam,
    StringParam: StringParam,
    BooleanParam: IDL.Null,
});
const SlashCommandParam = IDL.Record({
    name: IDL.Text,
    description: IDL.Opt(IDL.Text),
    required: IDL.Bool,
    placeholder: IDL.Opt(IDL.Text),
    param_type: SlashCommandParamType,
});
const SlashCommandSchema = IDL.Record({
    permissions: SlashCommandPermissions,
    name: IDL.Text,
    description: IDL.Opt(IDL.Text),
    params: IDL.Vec(SlashCommandParam),
});

export function createRegisterExternalBotPayload(candidate: CandidateExternalBot): Uint8Array {
    return new Uint8Array(
        IDL.encode(
            [
                IDL.Record({
                    principal: IDL.Principal,
                    endpoint: IDL.Text,
                    owner: IDL.Principal,
                    name: IDL.Text,
                    description: IDL.Text,
                    commands: IDL.Vec(SlashCommandSchema),
                    avatar: IDL.Opt(IDL.Text),
                }),
            ],
            [],
        ),
    );
}

export function createRegisterExternalAchievementPayload(
    id: number,
    userId: string,
    name: string,
    url: string,
    logo: string | undefined,
    canisterId: string,
    chitReward: number,
    expiryTimestampMillis: bigint,
    maxAwards: number,
): Uint8Array {
    return new Uint8Array(
        IDL.encode(
            [
                IDL.Record({
                    id: IDL.Nat32,
                    submitted_by: IDL.Principal,
                    name: IDL.Text,
                    url: IDL.Text,
                    logo: IDL.Opt(IDL.Text),
                    canister_id: IDL.Principal,
                    chit_reward: IDL.Nat32,
                    expires: IDL.Nat64,
                    max_awards: IDL.Nat32,
                }),
            ],
            [
                {
                    id,
                    submitted_by: Principal.fromText(userId),
                    name,
                    url,
                    logo: optionalStringToCandid(logo),
                    canisterId: Principal.fromText(canisterId),
                    chit_reward: chitReward,
                    expires: expiryTimestampMillis,
                    max_awards: maxAwards,
                },
            ],
        ),
    );
}

function optionalStringToCandid(value: string | undefined): [string] | [] {
    return value !== undefined && value.length > 0 ? [value] : [];
}
