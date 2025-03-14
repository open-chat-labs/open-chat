use candid::CandidType;
use enum_repr::EnumRepr;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct OCError(u16, Option<String>);

impl OCError {
    pub const fn new(code: OCErrorCode, message: String) -> Self {
        OCError(code as u16, Some(message))
    }
}

impl From<OCErrorCode> for OCError {
    fn from(value: OCErrorCode) -> Self {
        OCError(value as u16, None)
    }
}

#[EnumRepr(type = "u16", implicit = true)]
pub enum OCErrorCode {
    // NotAuthorized
    InitiatorNotFound = 100,
    InitiatorNotAuthorized,
    InitiatorSuspended,
    InitiatorNotInChat,
    InitiatorNotInCommunity,
    InitiatorLapsed,

    // Invalid
    ChatNotFound = 200,
    MessageNotFound,
    CommunityNotFound,
    ThreadNotFound,
    CanisterNotFound,
    SwapNotFound,
    VideoCall,
    BotNotFound,
    OwnerNotFound,
    NewOwnerNotFound,
    InvalidRequest,
    InvalidReaction,
    InvalidPrincipal,
    InvalidAvatar,
    InvalidEndpoint,
    InvalidFlags,
    InvalidTerm,
    InvalidLanguage,
    InvalidAccessGate,
    NameTooShort,
    NameTooLong,
    TermTooShort,
    TermTooLong,
    DescriptionTooLong,
    AlreadyRegistered,
    PrincipalAlreadyUsed,
    AlreadyAdded,
    AlreadySet,
    AlreadyAwarded,
    AlreadyLifetimeDiamondMember,
    AlreadyReported,
    OwnerSuspended,
    NewOwnerSuspended,
    ChatFrozen,
    CommunityFrozen,
    InsufficientFunds,
    PinRequired,
    PinIncorrect,
    TooManyFailedPinAttempts,
    UserLimitReached,
    CannotBlockSelf,
    CannotBlockUser,
    CommunityNotPublic,
    TargetUserNotInCommunity,
    NotInitialized,
    NewRegistrationsClosed,
    Expired,
    DelegationTooOld,
    MalformedSignature,
    CurrencyNotSupported,
    PriceMismatch,
    NameTaken,
    TooManyCommands,
    NotDiamondMember,
    UnexpectedIndex,
    NoChange,

    // InternalError
    C2CError = 300,
}

impl TryFrom<u16> for OCErrorCode {
    type Error = ();

    fn try_from(value: u16) -> Result<Self, Self::Error> {
        OCErrorCode::from_repr(value).ok_or(())
    }
}
