use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, ModerationReportContent, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub report: ModerationReportContent,
}

pub type Response = UnitResult;
