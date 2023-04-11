use crate::NNS_INTERNET_IDENTITY_CANISTER_ID;
use candid::Principal;
use rand::RngCore;
use types::MessageId;

pub fn random_principal() -> Principal {
    let random_bytes = rand::thread_rng().next_u32().to_ne_bytes();

    Principal::from_slice(&random_bytes)
}

pub fn random_user_principal() -> (Principal, Vec<u8>) {
    let random_bytes = rand::thread_rng().next_u32().to_ne_bytes();

    let mut public_key = Vec::new();
    public_key.extend_from_slice(NNS_INTERNET_IDENTITY_CANISTER_ID.as_slice());
    public_key.insert(0, public_key.len() as u8);
    public_key.extend_from_slice(&random_bytes);

    (Principal::self_authenticating(&public_key), public_key)
}

pub fn random_string() -> String {
    rand::thread_rng().next_u32().to_string()
}

pub fn random_message_id() -> MessageId {
    MessageId::generate(rand::thread_rng())
}
