use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, UnitResult};

// The LocalGroupIndex which ran alongside this LocalUserIndex, before its work was moved in here,
// and which the GroupIndex has made this LocalUserIndex a controller of, along with the canisters
// which that LocalGroupIndex alone still controls. These were in its canister pool, which was moved
// into this LocalUserIndex's without their controllers changing, so this LocalUserIndex could
// neither use them nor refund their cycles.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub local_group_index_canister_id: CanisterId,
    pub canister_ids: Vec<CanisterId>,
}

pub type Response = UnitResult;
