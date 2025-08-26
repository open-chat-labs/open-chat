use crate::ChildCanisterType;
use serde::{Deserialize, Serialize};
use types::CanisterWasmBytes;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_type: ChildCanisterType,
    pub chunk: CanisterWasmBytes,
    pub index: u8,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UnexpectedIndex(u8),
}
