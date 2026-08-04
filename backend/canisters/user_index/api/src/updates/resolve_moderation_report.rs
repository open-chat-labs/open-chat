use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(user_index, resolve_moderation_report)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub report_index: u64,
    pub verdict: ModerationVerdict,
    // Set on UpheldAsCsam where the reviewer judges there to be an imminent threat to a child,
    // marking the resulting authority report as urgent (the UK "immediately" reporting tier)
    #[serde(default)]
    pub urgent: Option<bool>,
}

#[ts_export(user_index, resolve_moderation_report)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModerationVerdict {
    // The message broke the platform rules - delete it and suspend the sender
    Upheld,
    // The message is CSAM - delete it and suspend the sender indefinitely
    UpheldAsCsam,
    // The message did not break the platform rules - clear any moderation flags
    Dismissed,
}

pub type Response = UnitResult;
