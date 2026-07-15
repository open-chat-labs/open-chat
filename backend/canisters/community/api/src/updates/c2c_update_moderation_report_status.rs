use serde::{Deserialize, Serialize};
use types::{ChannelId, MessageId, ModerationReportStatus, UnitResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_id: MessageId,
    pub status: ModerationReportStatus,
}

pub type Response = UnitResult;
