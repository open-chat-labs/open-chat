use candid::CandidType;
use ts_export::ts_export;
use types::{ChatId, GateCheckFailedReason, GroupCanisterGroupChatSummary, VerifiedCredentialGateArgs};

#[ts_export(local_user_index, join_group)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub chat_id: ChatId,
    pub invite_code: Option<u64>,
    pub verified_credential_args: Option<VerifiedCredentialGateArgs>,
    pub correlation_id: u64,
}

#[ts_export(local_user_index, join_group)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(Box<GroupCanisterGroupChatSummary>),
    AlreadyInGroup,
    AlreadyInGroupV2(Box<GroupCanisterGroupChatSummary>),
    GateCheckFailed(GateCheckFailedReason),
    GroupNotFound,
    GroupNotPublic,
    NotInvited,
    ParticipantLimitReached(u32),
    Blocked,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
