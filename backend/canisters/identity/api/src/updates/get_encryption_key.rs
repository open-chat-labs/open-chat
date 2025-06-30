use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub key_type: KeyType,
    pub transport_public_key: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub enum KeyType {
    User,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SuccessResult {
    pub encrypted_key: Vec<u8>,
}
