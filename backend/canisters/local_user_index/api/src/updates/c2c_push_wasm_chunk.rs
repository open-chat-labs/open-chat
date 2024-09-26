use crate::ChildCanisterType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_type: ChildCanisterType,
    #[serde(with = "serde_bytes")]
    pub chunk: Vec<u8>,
    pub index: u8,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UnexpectedIndex(u8),
}
