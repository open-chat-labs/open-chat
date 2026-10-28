use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotActionScope, BotCommandArg, BotCommandMeta, Chat, MessageId, MessageIndex, UserId, VideoCallType};

#[ts_export(local_user_index, access_token_v2)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Args {
    StartVideoCall(StartVideoCallArgs),
    JoinVideoCall(JoinVideoCallArgs),
    MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs),
    VideoCallParticipant(VideoCallParticipantArgs),
    BotActionByCommand(BotActionByCommandArgs),
    BotMessageSession(BotMessageSessionArgs),
    Translate,
}

#[ts_export(local_user_index, access_token_v2)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotAuthorized,
    InternalError(String),
    Error(OCError),
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StartVideoCallArgs {
    pub call_type: VideoCallType,
    #[serde(default)]
    #[ts(as = "Option<bool>", optional)]
    pub audio_only: bool,
    pub chat: Chat,
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JoinVideoCallArgs {
    pub chat: Chat,
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MarkVideoCallAsEndedArgs {
    pub chat: Chat,
}

// A token that says only that the caller belongs to this chat. The video bridge takes it for
// a decline or a leave of the chat's call; a join needs a `JoinVideoCall` token.
#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VideoCallParticipantArgs {
    pub chat: Chat,
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotActionByCommandArgs {
    pub bot_id: UserId,
    pub command: BotCommandInitial,
    pub scope: BotActionScope,
}

// A token which says who the caller is to the app a bot opens from one of its MiniApp messages. The
// website fetches it when the app is opened, and again whenever the app asks for a fresh one.
#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BotMessageSessionArgs {
    pub bot_id: UserId,
    pub chat: Chat,
    pub thread: Option<MessageIndex>,
    pub message_id: MessageId,
    pub meta: Option<BotCommandMeta>,
}

#[ts_export]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct BotCommandInitial {
    pub name: String,
    pub args: Vec<BotCommandArg>,
    pub meta: Option<BotCommandMeta>,
}
