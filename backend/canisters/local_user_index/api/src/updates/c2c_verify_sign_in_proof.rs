use serde::{Deserialize, Serialize};
use types::{UnitResult, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub sign_in_proof_jwt: String,
    // The user the MultiUser canister is acting for
    pub user_id: UserId,
}

pub type Response = UnitResult;
