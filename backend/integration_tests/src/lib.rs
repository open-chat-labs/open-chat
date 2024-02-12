#![cfg(test)]

use crate::utils::principal_to_username;
use candid::Principal;
use pocket_ic::PocketIc;
use types::{CanisterId, Cycles, UserId};

mod batched_summary_and_event_tests;
mod change_group_role_tests;
mod client;
mod communities;
mod cycles_dispenser_tests;
mod delete_direct_chat_tests;
mod delete_group_tests;
mod delete_message_tests;
mod diamond_membership_tests;
mod disappearing_message_tests;
mod env;
mod escrow_tests;
mod fire_and_forget_handler_tests;
mod freeze_group_tests;
mod gated_group_tests;
mod identity_tests;
mod join_group_tests;
mod last_online_date_tests;
mod mentions_tests;
mod notification_tests;
mod p2p_swap_tests;
mod platform_moderator_tests;
mod poll_tests;
mod prize_message_tests;
mod register_user_tests;
mod registry_tests;
mod remove_from_group_tests;
mod rng;
mod save_crypto_account_tests;
mod send_crypto_tests;
mod send_direct_message_tests;
mod set_message_reminder_tests;
mod setup;
mod storage;
mod suspend_user_tests;
mod tip_message_tests;
mod update_group_tests;
mod update_profile_tests;
mod utils;
mod wasms;

pub struct TestEnv {
    pub env: PocketIc,
    pub canister_ids: CanisterIds,
    pub controller: Principal,
}

#[derive(Debug)]
pub struct User {
    pub principal: Principal,
    pub user_id: UserId,
    pub public_key: Vec<u8>,
}

impl User {
    pub fn canister(&self) -> CanisterId {
        self.user_id.into()
    }

    pub fn username(&self) -> String {
        principal_to_username(self.principal)
    }
}

impl From<&User> for types::User {
    fn from(value: &User) -> Self {
        types::User {
            user_id: value.user_id,
            username: value.username(),
        }
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
    pub identity: CanisterId,
    pub online_users: CanisterId,
    pub proposals_bot: CanisterId,
    pub storage_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub registry: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub icp_ledger: CanisterId,
    pub chat_ledger: CanisterId,
    pub cycles_minting_canister: CanisterId,
}

const T: Cycles = 1_000_000_000_000;
const NNS_INTERNET_IDENTITY_CANISTER_ID: CanisterId = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 10, 1, 1]);
