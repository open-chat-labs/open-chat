use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

pub type Response = UnitResult;
