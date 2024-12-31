/* eslint-disable @typescript-eslint/no-explicit-any */
import { IDL } from "@dfinity/candid";
import { Principal } from "@dfinity/principal";
import {
    type ExternalBot,
    type SlashCommandPermissions,
    type ChatPermissions,
    type CommunityPermissions,
    type MessagePermission,
    type SlashCommandParam,
} from "openchat-client";

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

const ApiGroupPermission = IDL.Variant({
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
const ApiCommunityPermission = IDL.Variant({
    RemoveMembers: IDL.Null,
    CreatePublicChannel: IDL.Null,
    InviteUsers: IDL.Null,
    ManageUserGroups: IDL.Null,
    UpdateDetails: IDL.Null,
    CreatePrivateChannel: IDL.Null,
    ChangeRoles: IDL.Null,
});
const ApiMessagePermission = IDL.Variant({
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
const ApiSlashCommandPermissions = IDL.Record({
    chat: IDL.Vec(ApiGroupPermission),
    community: IDL.Vec(ApiCommunityPermission),
    thread: IDL.Vec(ApiMessagePermission),
    message: IDL.Vec(ApiMessagePermission),
});
const ApiNumberParamChoice = IDL.Record({
    value: IDL.Nat16,
    name: IDL.Text,
});
const ApiNumberParam = IDL.Record({
    min_length: IDL.Nat16,
    max_length: IDL.Nat16,
    choices: IDL.Vec(ApiNumberParamChoice),
});
const ApiStringParamChoice = IDL.Record({
    value: IDL.Text,
    name: IDL.Text,
});
const ApiStringParam = IDL.Record({
    min_length: IDL.Nat16,
    max_length: IDL.Nat16,
    choices: IDL.Vec(ApiStringParamChoice),
});
const ApiSlashCommandParamType = IDL.Variant({
    UserParam: IDL.Null,
    NumberParam: ApiNumberParam,
    StringParam: ApiStringParam,
    BooleanParam: IDL.Null,
});
const ApiSlashCommandParam = IDL.Record({
    name: IDL.Text,
    description: IDL.Opt(IDL.Text),
    required: IDL.Bool,
    placeholder: IDL.Opt(IDL.Text),
    param_type: ApiSlashCommandParamType,
});
const ApiSlashCommandSchema = IDL.Record({
    permissions: ApiSlashCommandPermissions,
    name: IDL.Text,
    description: IDL.Opt(IDL.Text),
    params: IDL.Vec(ApiSlashCommandParam),
});

function createCommandParamType(param: SlashCommandParam): Record<string, any> {
    switch (param.kind) {
        case "boolean":
            return { BooleanParam: null };
        case "string":
            return {
                StringParam: {
                    min_length: param.minLength,
                    max_length: param.maxLength,
                    choices: param.choices.map((c) => ({
                        name: c.name,
                        value: c.value,
                    })),
                },
            };
        case "user":
            return { UserParam: null };
        case "number":
            return {
                NumberParam: {
                    min_length: param.minValue,
                    max_length: param.maxValue,
                    choices: param.choices.map((c) => ({
                        name: c.name,
                        value: c.value,
                    })),
                },
            };
        default:
            return {};
    }
}

function createGroupPermission(perm: keyof ChatPermissions): Record<string, any> {
    switch (perm) {
        case "addMembers":
            return { AddMembers: null };
        case "changeRoles":
            return { ChangeRoles: null };
        case "deleteMessages":
            return { DeleteMessages: null };
        case "inviteUsers":
            return { InviteUsers: null };
        case "mentionAllMembers":
            return { MentionAllMembers: null };
        case "pinMessages":
            return { PinMessages: null };
        case "reactToMessages":
            return { ReactToMessages: null };
        case "removeMembers":
            return { RemoveMembers: null };
        case "startVideoCall":
            return { StartVideoCall: null };
        case "updateGroup":
            return { UpdateGroup: null };
        default:
            return {};
    }
}

function createCommunityPermission(perm: keyof CommunityPermissions): Record<string, any> {
    switch (perm) {
        case "changeRoles":
            return { ChangeRoles: null };
        case "createPrivateChannel":
            return { CreatePrivateChannel: null };
        case "createPublicChannel":
            return { CreatePublicChannel: null };
        case "inviteUsers":
            return { InviteUsers: null };
        case "manageUserGroups":
            return { ManageUserGroups: null };
        case "removeMembers":
            return { RemoveMembers: null };
        case "updateDetails":
            return { UpdateDetails: null };
        default:
            return {};
    }
}

function createMessagePermission(perm: MessagePermission): Record<string, any> {
    switch (perm) {
        case "audio":
            return { Audio: null };
        case "crypto":
            return { Crypto: null };
        case "file":
            return { File: null };
        case "giphy":
            return { Giphy: null };
        case "image":
            return { Image: null };
        case "memeFighter":
            return { MemeFighter: null };
        case "p2pSwap":
            return { P2pSwap: null };
        case "poll":
            return { Poll: null };
        case "prize":
            return { Prize: null };
        case "text":
            return { Text: null };
        case "video":
            return { Video: null };
        default:
            return {};
    }
}

function createPermissions(perm: SlashCommandPermissions): Record<string, any> {
    return {
        chat: perm.chatPermissions.map(createGroupPermission),
        community: perm.communityPermissions.map(createCommunityPermission),
        message: perm.messagePermissions.map(createMessagePermission),
        thread: perm.messagePermissions.map(createMessagePermission),
    };
}

export function createRegisterExternalBotPayload(
    userId: string,
    ownerId: string,
    candidate: ExternalBot,
): Uint8Array {
    return new Uint8Array(
        IDL.encode(
            [
                IDL.Record({
                    principal: IDL.Principal,
                    endpoint: IDL.Text,
                    owner: IDL.Principal,
                    name: IDL.Text,
                    description: IDL.Text,
                    commands: IDL.Vec(ApiSlashCommandSchema),
                    avatar: IDL.Opt(IDL.Text),
                }),
            ],
            [
                {
                    principal: Principal.fromText(userId),
                    endpoint: candidate.endpoint,
                    owner: Principal.fromText(ownerId),
                    name: candidate.name,
                    description: candidate.definition.description ?? "",
                    avatar: optionalStringToCandid(candidate.avatarUrl),
                    commands: candidate.definition.commands.map((c) => ({
                        name: c.name,
                        description: optionalStringToCandid(c.description),
                        permissions: createPermissions(c.permissions),
                        params: c.params.map((p) => ({
                            name: p.name,
                            description: optionalStringToCandid(p.description),
                            required: p.required,
                            placeholder: optionalStringToCandid(p.placeholder),
                            param_type: createCommandParamType(p),
                        })),
                    })),
                },
            ],
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
                    canister_id: Principal.fromText(canisterId),
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
