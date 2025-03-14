use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotActionScope, BotCommandArg, BotCommandMeta, Chat, UserId, VideoCallType};

#[ts_export(local_user_index, access_token_v2)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Args {
    StartVideoCall(StartVideoCallArgs),
    JoinVideoCall(JoinVideoCallArgs),
    MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs),
    BotActionByCommand(BotActionByCommandArgs),
    BotActionByApiKey(String),
}

#[ts_export(local_user_index, access_token_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
    Error(OCError),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct StartVideoCallArgs {
    pub call_type: VideoCallType,
    pub chat: Chat,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct JoinVideoCallArgs {
    pub chat: Chat,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct MarkVideoCallAsEndedArgs {
    pub chat: Chat,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct BotActionByCommandArgs {
    pub bot_id: UserId,
    pub command: BotCommandInitial,
    pub scope: BotActionScope,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommandInitial {
    pub name: String,
    pub args: Vec<BotCommandArg>,
    pub meta: Option<BotCommandMeta>,
}
