use crate::NotifyError;
use candid::{CandidType, Principal};

pub type CanisterId = Principal;
pub type Cycles = u128;
pub type BlockIndex = u64;

#[derive(CandidType)]
pub struct Args {
    pub block_index: BlockIndex,
    pub canister_id: CanisterId,
}

pub type Response = Result<Cycles, NotifyError>;
