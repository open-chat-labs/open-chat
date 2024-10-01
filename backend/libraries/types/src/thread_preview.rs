use crate::{EventWrapper, Message};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ThreadPreview {
    #[ts(as = "crate::EventWrapperMessage")]
    pub root_message: EventWrapper<Message>,
    #[ts(as = "Vec::<crate::EventWrapperMessage>")]
    pub latest_replies: Vec<EventWrapper<Message>>,
    pub total_replies: u32,
}
