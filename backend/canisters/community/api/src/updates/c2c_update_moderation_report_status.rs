use serde::{Deserialize, Serialize};
use types::{AuthorityReportState, ChannelId, MessageId, ModerationReportStatus, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
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
}

pub type Response = UnitResult;
