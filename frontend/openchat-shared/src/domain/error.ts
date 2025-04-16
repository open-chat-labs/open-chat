import type {PinNumberFailures} from "./chat";
import {parseBigInt} from "../utils";

export type OCError = {
    kind: "error";
    code: number;
    message: string | undefined;
}

export class UnsupportedValueError extends Error {
    constructor(msg: string, value: never) {
        super(`${msg}: ${value}`);
    }
}

export class HttpError extends Error {
    constructor(
        public code: number,
        error: Error,
    ) {
        super(error.message);
        this.stack = error.stack;
        this.name = "HttpError";
    }
}

export class NoMeetingToJoin extends Error {}

export class AuthError extends HttpError {
    constructor(
        public code: number,
        error: Error,
    ) {
        super(code, error);
        this.name = "AuthError";
    }
}

export class SessionExpiryError extends HttpError {
    constructor(
        public code: number,
        error: Error,
    ) {
        super(code, error);
        this.name = "SessionExpiryError";
    }
}

export class DestinationInvalidError extends HttpError {
    constructor(error: Error) {
        super(404, error);
        this.name = "DestinationInvalidError";
    }
}

export class ResponseTooLargeError extends HttpError {
    constructor(
        error: Error,
        public size: number,
        public maxSize: number,
    ) {
        super(500, error);
        this.name = "ResponseTooLargeError";
    }
}

export class InvalidDelegationError extends HttpError {
    constructor(error: Error) {
        super(403, error);
        this.name = "InvalidDelegationError";
    }
}

export class TypeboxValidationError extends Error {
    constructor(error?: Error) {
        super();
        this.name = "TypeboxValidationError";
        this.message = error?.message ?? "";
        this.stack = error?.stack;
    }
}

// We'll use this is the front end tries to do something that the anonymous user should not be able to do
export class AnonymousOperationError extends Error {
    constructor() {
        super();
        this.name = "AnonymousOperationError";
    }
}

export enum ErrorCode {
    Unknown = 0,

    // NotAuthorized
    InitiatorNotFound = 100,
    InitiatorNotAuthorized = 101,
    InitiatorSuspended = 102,
    InitiatorNotInChat = 103,
    InitiatorNotInCommunity = 104,
    InitiatorLapsed = 105,
    InitiatorBlocked = 106,

    // Invalid
    ChatNotFound = 200,
    MessageNotFound = 201,
    CommunityNotFound = 202,
    ThreadNotFound = 203,
    CanisterNotFound = 204,
    TargetUserNotFound = 205,
    SwapNotFound = 206,
    BotNotFound = 207,
    OwnerNotFound = 208,
    NewOwnerNotFound = 209,
    InvalidRequest = 210,
    InvalidReaction = 211,
    InvalidPrincipal = 212,
    InvalidAvatar = 213,
    InvalidEndpoint = 214,
    InvalidFlags = 215,
    InvalidTerm = 216,
    InvalidLanguage = 217,
    InvalidAccessGate = 218,
    NameTooShort = 219,
    NameTooLong = 220,
    TermTooShort = 221,
    TermTooLong = 222,
    DescriptionTooLong = 223,
    AlreadyRegistered = 224,
    PrincipalAlreadyUsed = 225,
    AlreadyAdded = 226,
    AlreadySet = 227,
    AlreadyAwarded = 228,
    AlreadyLifetimeDiamondMember = 229,
    AlreadyReported = 230,
    OwnerSuspended = 231,
    NewOwnerSuspended = 232,
    ChatFrozen = 233,
    CommunityFrozen = 234,
    InsufficientFunds = 235,
    PinRequired = 236,
    PinIncorrect = 237,
    TooManyFailedPinAttempts = 238,
    UserLimitReached = 239,
    CannotBlockSelf = 240,
    CannotBlockUser = 241,
    CommunityPublic = 242,
    CommunityNotPublic = 243,
    TargetUserNotInCommunity = 244,
    TargetUserNotInChat = 245,
    NotInitialized = 246,
    Expired = 247,
    DelegationTooOld = 248,
    MalformedSignature = 249,
    PriceMismatch = 250,
    NameTaken = 251,
    TooManyCommands = 252,
    NotDiamondMember = 253,
    UnexpectedIndex = 254,
    NoChange = 255,

    CyclesBalanceTooLow = 257,
    AlreadyInProgress = 258,
    InvalidPublicKey = 259,
    InvalidReferralCode = 260,
    ReferralCodeAlreadyClaimed = 261,
    ReferralCodeExpired = 262,
    UsernameTooShort = 263,
    UsernameTooLong = 264,
    InvalidUsername = 265,
    DisplayNameTooShort = 266,
    DisplayNameTooLong = 267,
    InvalidDisplayName = 268,
    NotInvited = 269,
    CurrencyNotSupported = 270,
    InvalidRoleChange = 271,
    CannotRemoveSelf = 272,
    CannotTipSelf = 273,
    NameReserved = 274,
    RulesTooShort = 275,
    RulesTooLong = 276,
    AvatarTooBig = 277,
    RecipientMismatch = 278,
    NewRegistrationsClosed = 279,
    LastOwnerCannotLeave = 280,
    TooManyInvites = 281,
    CommunityRulesNotAccepted = 282,
    ChatRulesNotAccepted = 283,
    InvalidExternalUrl = 284,
    VideoCallAlreadyEnded = 285,
    TargetUserBlocked = 286,
    MessageIdAlreadyExists = 287,
    ReplicaNotUpToDate = 288,
    InvalidMessageContent = 289,
    TransferCannotBeZero = 290,
    NoActiveStreak = 291,
    TextTooLong = 292,
    MessageHardDeleted = 293,
    InvalidMessageType = 294,
    ApiKeyNotFound = 295,
    TooManyUsers = 296,
    VideoCallNotFound = 297,
    PrizeNotFound = 298,
    PrizeEnded = 299,
    PrizeFullyClaimed = 300,
    PrizeAlreadyClaimed = 301,
    PrizeLedgerError = 302,
    InvalidName = 303,
    UserGroupNotFound = 304,
    ChatNotPublic = 305,
    PollNotFound = 306,
    PollEnded = 307,
    PollOptionNotFound = 308,
    CannotChangeVote = 309,
    AlreadyImportingIntoAnotherCommunity = 310,
    InvalidSignature = 311,
    TransferFailed = 312,
    GroupAlreadyBeingImported = 313,
    BannerTooBig = 314,
    CannotChangeRoleOfLastOwner = 315,
    CannotMakeBotOwner = 316,
    MessageAlreadyFinalized = 317,
    MaxGroupsCreated = 318,
    MaxCommunitiesCreated = 319,
    Throttled = 320,
    InvalidChannelName = 321,
    ApprovalFailed = 322,
    TransferCannotBeToSelf = 323,
    DateInThePast = 324,
    SwapFailed = 325,
    PinTooShort = 326,
    PinTooLong = 327,
    SwapStatusOpen = 328,
    SwapStatusCancelled = 329,
    SwapStatusExpired = 330,
    SwapStatusReserved = 331,
    SwapStatusAccepted = 332,
    SwapStatusCompleted = 333,

    // InternalError
    C2CError = 500,

    // Impossible (supposedly)
    Impossible = 600,
}

export function pinNumberFailureFromError(error: OCError): PinNumberFailures | undefined {
    switch (error.code) {
        case ErrorCode.PinRequired:
            return { kind: "pin_required" };

        case ErrorCode.PinIncorrect:
            return {
                kind: "pin_incorrect",
                nextRetryAt: parseBigInt(error.message ?? "0") ?? BigInt(0),
            };

        case ErrorCode.TooManyFailedPinAttempts:
            return {
                kind: "too_main_failed_pin_attempts",
                nextRetryAt: parseBigInt(error.message ?? "0") ?? BigInt(0),
            };

        default:
            return undefined;
    }
}