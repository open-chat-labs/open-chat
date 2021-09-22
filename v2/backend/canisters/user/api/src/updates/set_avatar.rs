use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;
use types::FieldTooLongResult;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub id: u128,
    pub mime_type: String,
    pub data: ByteBuf,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(u128),
    AvatarTooBig(FieldTooLongResult),
}
