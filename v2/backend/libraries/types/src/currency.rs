use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Copy, Clone, Debug)]
pub enum Currency {
    ICP,
    Cycles,
}
