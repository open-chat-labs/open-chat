use crate::{BotPermissions, UserId, VideoCallType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AccessTypeArgs {
    StartVideoCall(StartVideoCallArgs),
    JoinVideoCall(JoinVideoCallArgs),
    MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs),
    BotActionByCommand(BotActionByCommandArgs),
    BotActionByApiKey(BotActionByApiKeyArgs),
    BotReadApiKey(BotReadApiKeyArgs),
}

impl AccessTypeArgs {
    pub fn requested_permissions(&self) -> Option<BotPermissions> {
        match self {
            AccessTypeArgs::BotActionByCommand(args) => Some(args.requested_permissions.clone()),
            AccessTypeArgs::BotActionByApiKey(args) => Some(args.requested_permissions.clone()),
            _ => None,
        }
    }

    pub fn initiator(&self) -> Option<UserId> {
        match self {
            AccessTypeArgs::StartVideoCall(args) => Some(args.initiator),
            AccessTypeArgs::JoinVideoCall(args) => Some(args.initiator),
            AccessTypeArgs::MarkVideoCallAsEnded(args) => Some(args.initiator),
            AccessTypeArgs::BotActionByCommand(args) => Some(args.initiator),
            AccessTypeArgs::BotReadApiKey(args) => Some(args.initiator),
            _ => None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Failure,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StartVideoCallArgs {
    pub call_type: VideoCallType,
    pub initiator: UserId,
    pub is_diamond: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JoinVideoCallArgs {
    pub initiator: UserId,
    pub is_diamond: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MarkVideoCallAsEndedArgs {
    pub initiator: UserId,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotActionByCommandArgs {
    pub bot_id: UserId,
    pub initiator: UserId,
    pub requested_permissions: BotPermissions,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotActionByApiKeyArgs {
    pub bot_id: UserId,
    pub secret: String,
    pub requested_permissions: BotPermissions,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotReadApiKeyArgs {
    pub bot_id: UserId,
    pub initiator: UserId,
}
