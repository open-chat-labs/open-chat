use candid::CandidType;
use enum_repr::EnumRepr;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct OCError(u16, Option<String>);

impl From<OCErrorCode> for OCError {
    fn from(value: OCErrorCode) -> Self {
        OCError(value as u16, None)
    }
}

#[EnumRepr(type = "u16", implicit = true)]
pub enum OCErrorCode {
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
    CommunityNotPublic = 242,
    TargetUserNotInCommunity = 243,
    NotInitialized = 244,
    NewRegistrationsClosed = 245,
    Expired = 246,
    DelegationTooOld = 247,
    MalformedSignature = 248,
    CurrencyNotSupported = 249,
    PriceMismatch = 250,
    NameTaken = 251,
    TooManyCommands = 252,
    NotDiamondMember = 253,
    UnexpectedIndex = 254,
    NoChange = 255,
    SwapStatusError = 256,
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

    // InternalError
    C2CError = 500,

    // Impossible
    Impossible = 600,
}

impl TryFrom<u16> for OCErrorCode {
    type Error = ();

    fn try_from(value: u16) -> Result<Self, Self::Error> {
        OCErrorCode::from_repr(value).ok_or(())
    }
}

impl OCErrorCode {
    pub fn with_message(self, message: impl ToString) -> OCError {
        OCError(self as u16, Some(message.to_string()))
    }

    pub fn with_json<T: Serialize>(self, data: &T) -> OCError {
        OCError(self as u16, Some(serde_json::to_string(data).unwrap()))
    }
}
