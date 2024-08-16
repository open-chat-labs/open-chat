use crate::AirdropConfig;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = AirdropConfig;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChannelUsed,
    InThePast,
    ClashesWithPrevious,
}
