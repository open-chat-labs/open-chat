use candid::Principal;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

// Sets the personhood_verifier canister id on a live user_index. On upgrade
// the id defaults to anonymous (init args do not re-run), so without this a
// production user_index would reject the verifier's proof notifications and
// skip embedding deletion. Governance-controlled.
#[ts_export(user_index, set_personhood_verifier_canister_id)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: Principal,
}

pub type Response = UnitResult;
