#![cfg(test)]

use crate::utils::principal_to_username;
use candid::Principal;
use ic_test_state_machine_client::StateMachine;
use types::{CanisterId, Cycles, UserId};

mod client;
mod cycles_dispenser_tests;
mod delete_group_tests;
mod delete_message_tests;
mod diamond_membership_tests;
mod disappearing_message_tests;
mod env;
mod freeze_group_tests;
mod join_group_tests;
mod last_online_date_tests;
mod notification_tests;
mod poll_tests;
mod register_user_tests;
mod rng;
mod send_direct_message_tests;
mod setup;
mod storage;
mod suspend_user_tests;
mod utils;
mod wasms;

pub struct TestEnv {
    pub env: StateMachine,
    pub canister_ids: CanisterIds,
    pub controller: Principal,
}

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
    pub notifications_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
    pub online_users: CanisterId,
    pub proposals_bot: CanisterId,
    pub storage_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub icp_ledger: CanisterId,
    pub cycles_minting_canister: CanisterId,
}

const T: Cycles = 1_000_000_000_000;
