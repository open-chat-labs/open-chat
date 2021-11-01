use candid::CandidType;
use serde::Deserialize;
use types::CanisterId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub test_mode: bool,
}
