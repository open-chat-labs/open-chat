use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotActionScope, BotApiKeyToken, BotCommand, CanisterId, Chat, UserId, VideoCallType};
use utils::base64;

#[ts_export(local_user_index, access_token_v2)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Args {
    StartVideoCall(StartVideoCallArgs),
    JoinVideoCall(JoinVideoCallArgs),
    MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs),
    BotActionByCommand(BotActionByCommandArgs),
    BotActionByApiKey(#[serde(deserialize_with = "deserialize_bot_action_by_api_key_args")] BotApiKeyToken),
}

fn deserialize_bot_action_by_api_key_args<'de, D>(deserializer: D) -> Result<BotApiKeyToken, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let str = String::deserialize(deserializer)?;
    base64::to_value(&str).map_err(serde::de::Error::custom)
}

#[ts_export(local_user_index, access_token_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
}

impl Args {
    pub fn canister_id(&self) -> CanisterId {
        match self {
            Args::StartVideoCall(args) => args.chat.canister_id(),
            Args::JoinVideoCall(args) => args.chat.canister_id(),
            Args::MarkVideoCallAsEnded(args) => args.chat.canister_id(),
            Args::BotActionByCommand(args) => args.scope.canister_id(),
            Args::BotActionByApiKey(args) => args.scope.canister_id(),
        }
    }

    pub fn type_name(&self) -> &str {
        match self {
            Args::StartVideoCall(_) => "StartVideoCall",
            Args::JoinVideoCall(_) => "JoinVideoCall",
            Args::MarkVideoCallAsEnded(_) => "MarkVideoCallAsEnded",
            Args::BotActionByCommand(_) => "BotActionByCommand",
            Args::BotActionByApiKey(_) => "BotActionByApiKey",
        }
    }
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
    pub command: BotCommand,
    pub scope: BotActionScope,
}
