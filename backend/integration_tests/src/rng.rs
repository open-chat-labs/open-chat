use candid::Principal;
use rand::RngCore;
use types::MessageId;

pub fn random_principal() -> Principal {
    let random_bytes = rand::thread_rng().next_u32().to_ne_bytes();

    Principal::from_slice(&random_bytes)
}

pub fn random_string() -> String {
    rand::thread_rng().next_u32().to_string()
}

pub fn random_message_id() -> MessageId {
    MessageId::generate(rand::thread_rng())
}
