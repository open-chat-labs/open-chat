use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub sign_in_proof_jwt: String,
}

pub type Response = UnitResult;
