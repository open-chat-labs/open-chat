use crate::{BotPermissions, GroupRole, UserId, VideoCallType};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AccessTypeArgs {
    StartVideoCall(StartVideoCallArgs),
    JoinVideoCall(JoinVideoCallArgs),
    MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs),
    BotActionByCommand(BotActionByCommandArgs),
    MiniAppChat(MiniAppChatArgs),
}

impl AccessTypeArgs {
    pub fn requested_permissions(&self) -> Option<BotPermissions> {
        match self {
            AccessTypeArgs::BotActionByCommand(args) => Some(args.requested_permissions.clone()),
            _ => None,
        }
    }

    pub fn initiator(&self) -> UserId {
        match self {
            AccessTypeArgs::StartVideoCall(args) => args.initiator,
            AccessTypeArgs::JoinVideoCall(args) => args.initiator,
            AccessTypeArgs::MarkVideoCallAsEnded(args) => args.initiator,
            AccessTypeArgs::BotActionByCommand(args) => args.initiator,
            AccessTypeArgs::MiniAppChat(args) => args.initiator,
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
    #[serde(default)]
    pub audio_only: bool,
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
    pub initiator_role: GroupRole,
    pub requested_permissions: BotPermissions,
}

// For the MiniApp service's chat token: that the initiator is a member of the chat, who may join its
// games, or, if `member` is false, that they can see it, as anyone can a public chat, to watch them
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MiniAppChatArgs {
    pub initiator: UserId,
    pub member: bool,
}
