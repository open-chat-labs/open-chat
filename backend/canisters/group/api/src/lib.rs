use serde::{Deserialize, Serialize};
use ts_export::ts_export;

mod lifecycle;
mod queries;
mod updates;

use candid::CandidType;
pub use lifecycle::*;
use oc_error_codes::OCError;
pub use queries::*;
use types::{BotDefinitionUpdate, MediaScanMatched, MessageClassified, MessageId, MessageIndex, UserId};
pub use updates::*;

#[ts_export(group)]
#[derive(Serialize, Deserialize, Debug)]
pub enum EventsResponse {
    Success(types::EventsResponse),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum LocalIndexEvent {
    NameChanged(NameChanged),
    VerifiedChanged(VerifiedChanged),
    ModerationFlagsChanged(ModerationFlagsChanged),
    MessageClassified(MessageClassified),
    MediaScanMatched(MediaScanMatched),
    UserDeleted(UserId),
    BotUpdated(BotDefinitionUpdate),
    BotRemoved(UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NameChanged {
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VerifiedChanged {
    pub verified: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModerationFlagsChanged {
    pub flags: u32,
}

// The UserIndex's events, each applied as the endpoint it replaces applied it
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    FlagMessage(FlagMessage),
    DeleteMessages(DeleteMessages),
    ModerationUndelete(ModerationUndelete),
    ModerationHardDelete(ModerationHardDelete),
    SetUserSuspended(SetUserSuspended),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FlagMessage {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub flags: u32,
    // Delete the message as part of the same update. A moderation takedown must set the
    // read-gate flag and delete the message atomically: sent as two fire-and-forget messages
    // they carry no ordering guarantee, and a message deleted while its flag is still in
    // flight is readable by its sender through `deleted_message` and can be undeleted.
    #[serde(default)]
    pub delete: bool,
}

// Deleted as the platform moderator, as the UserIndex deletes a reported message
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DeleteMessages {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModerationUndelete {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ModerationHardDelete {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetUserSuspended {
    pub user_id: UserId,
    pub suspended: bool,
}
