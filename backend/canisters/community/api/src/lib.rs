use serde::{Deserialize, Serialize};
use ts_export::ts_export;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
use oc_error_codes::OCError;
pub use queries::*;
use types::{
    AuthorityReportState, BotDefinitionUpdate, ChannelId, MediaScanMatched, MessageClassified, MessageId, MessageIndex,
    ModerationReportContent, ModerationReportStatus, UserId,
};
pub use updates::*;

#[ts_export(community)]
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
    SendModerationNotice(SendModerationNotice),
    SendModerationReport(SendModerationReport),
    UpdateModerationReportStatus(UpdateModerationReportStatus),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FlagMessage {
    pub channel_id: ChannelId,
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
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModerationUndelete {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModerationHardDelete {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SetUserSuspended {
    pub user_id: UserId,
    pub suspended: bool,
}

// A plain-text OC-bot notice posted into the internal moderation channel by the user_index:
// for alarms which have no reported message to anchor a report card to
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SendModerationNotice {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub text: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SendModerationReport {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub report: ModerationReportContent,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateModerationReportStatus {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    // Each is applied when present, so verdict-status and authority-report updates can be
    // sent independently
    #[serde(default)]
    pub status: Option<ModerationReportStatus>,
    #[serde(default)]
    pub authority_report: Option<AuthorityReportState>,
    // Set when a protective quarantine is applied to an already-alerted report (a CSAM
    // assertion on an escalated report): flips the card to the vault review path
    #[serde(default)]
    pub auto_sanctioned: Option<bool>,
    // The current reporter set: an assertion can add a human reporter to a card that was
    // posted for an automated detection, and the moderator must see who asserted
    #[serde(default)]
    pub reporters: Option<Vec<UserId>>,
}
