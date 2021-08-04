use candid::CandidType;
use serde::Deserialize;
use shared::types::EventIndex;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ReplyContextInternal {
    pub event_index: EventIndex,
}
