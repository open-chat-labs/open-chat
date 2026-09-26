use serde::{Deserialize, Serialize};
use types::SuccessOnly;

// The maximum number of users being migrated to MultiUser canisters at once
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub value: u32,
}

pub type Response = SuccessOnly;
