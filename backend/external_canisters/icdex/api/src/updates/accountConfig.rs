use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = (Mode, bool, Vec<u8>);
pub type Response = ();

#[derive(CandidType, Serialize, Deserialize)]
pub enum Mode {
    PoolMode,
    TunnelMode,
}
