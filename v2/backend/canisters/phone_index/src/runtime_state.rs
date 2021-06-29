use crate::domain::phone_index::PhoneIndex;
use crate::env::Environment;
use crate::user_index_canister_client::UserIndexCanisterClient;

pub struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub user_index_canister_client: UserIndexCanisterClient,
    pub phone_index: PhoneIndex,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, user_index_canister_client: UserIndexCanisterClient, phone_index: PhoneIndex) -> RuntimeState {
        RuntimeState {
            env,
            user_index_canister_client,
            phone_index,
        }
    }
}
