use candid::{CandidType, Int, Nat};
use serde::Deserialize;
use serde_bytes::ByteBuf;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum MetadataValue {
    Nat(Nat),
    Int(Int),
    Text(String),
    Blob(ByteBuf),
}
