#![cfg(test)]

use crate::utils::principal_to_username;
use candid::Principal;
use types::{CanisterId, UserId};

mod client;
mod initial_state_and_updates_tests;
mod poll_tests;
mod register_user_tests;
mod rng;
mod send_message_tests;
mod setup;
mod suspend_user_tests;
mod utils;
mod wasms;

const SERVICE_PRINCIPAL: Principal = Principal::from_slice(&[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

#[derive(Debug)]
pub struct User {
    pub principal: Principal,
    pub user_id: UserId,
}

impl User {
    pub fn canister(&self) -> CanisterId {
        self.user_id.into()
    }

    pub fn username(&self) -> String {
        principal_to_username(self.principal)
    }
}

#[derive(Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications: CanisterId,
    pub online_users_aggregator: CanisterId,
    pub callback: CanisterId,
    pub proposals_bot: CanisterId,
    pub open_storage_index: CanisterId,
    pub ledger: CanisterId,
}
