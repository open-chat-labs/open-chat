use enum_repr::EnumRepr;

pub type OCError = (u16, Option<String>);

#[EnumRepr(type = "u16", implicit = true)]
pub enum OCErrorCode {
    C2CError = 100,
    NotAuthorized,
    UserNotInChat,
    UserNotInCommunity,
    MemberLapsed,
    ChatFrozen,
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

    // NotFound
    CallerNotFound = 200,
    ChatNotFound,
    MessageNotFound,
    CommunityNotFound,
    CanisterNotFound,
    SwapNotFound,
    BotNotFound,
    OwnerNotFound,
    NewOwnerNotFound,

    // Invalid
    InvalidRequest = 300,
    InvalidReaction,
    InvalidPrincipal,
    InvalidAvatar,
    InvalidEndpoint,
    InvalidFlags,
    InvalidTerm,
    InvalidLanguage,
    InvalidAccessGate,

    // AlreadyXyz
    AlreadyRegistered = 400,
    PrincipalAlreadyUsed,
    AlreadyAdded,
    AlreadySet,
    AlreadyAwarded,
    AlreadyLifetimeDiamondMember,
    AlreadyReported,

    // TooShort
    NameTooShort = 500,
    TermTooShort,

    // TooLong
    NameTooLong = 600,
    DescriptionTooLong,
    TermTooLong,

    // Suspended
    UserSuspended = 700,
    OwnerSuspended,
    NewOwnerSuspended,
}

impl TryFrom<u16> for OCErrorCode {
    type Error = ();

    fn try_from(value: u16) -> Result<Self, Self::Error> {
        OCErrorCode::from_repr(value).ok_or(())
    }
}
