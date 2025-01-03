#![cfg(test)]

use crate::utils::principal_to_username;
use candid::Principal;
use pocket_ic::PocketIc;
use registry_canister::subnets::Subnet;
use std::fmt::{Debug, Formatter};
use types::{CanisterId, Cycles, UserId};

mod airdrop_bot_tests;
mod batched_summary_and_event_tests;
mod bot_tests;
mod change_group_role_tests;
mod chit_tests;
mod client;
mod communities;
mod cycles_dispenser_tests;
mod delete_direct_chat_tests;
mod delete_group_tests;
mod delete_message_tests;
// mod delete_user_tests;
mod diamond_membership_tests;
mod disappearing_message_tests;
mod edit_message_tests;
mod env;
mod escrow_tests;
mod fire_and_forget_handler_tests;
mod freeze_group_tests;
mod gated_group_tests;
mod identity_tests;
mod join_group_tests;
mod last_online_date_tests;
mod mentions_tests;
mod message_activity_tests;
mod notification_tests;
mod p2p_swap_tests;
mod pin_number_tests;
// mod platform_moderator_tests;
mod poll_tests;
mod prize_message_tests;
mod register_user_tests;
mod registry_tests;
mod remove_from_group_tests;
mod save_crypto_account_tests;
mod send_crypto_tests;
mod send_direct_message_tests;
mod set_message_reminder_tests;
mod setup;
mod stable_memory;
mod storage;
mod storage_tests;
mod suspend_user_tests;
mod tip_message_tests;
mod update_group_tests;
mod update_profile_tests;
mod utils;
mod video_call_tests;
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
    pub local_user_index: CanisterId,
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

pub struct CanisterIds {
    pub openchat_installer: CanisterId,
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub identity: CanisterId,
    pub online_users: CanisterId,
    pub proposals_bot: CanisterId,
    pub airdrop_bot: CanisterId,
    pub storage_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub registry: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub event_store: CanisterId,
    pub sign_in_with_email: CanisterId,
    pub icp_ledger: CanisterId,
    pub chat_ledger: CanisterId,
    pub cycles_minting_canister: CanisterId,
    pub subnets: Vec<Subnet>,
}

impl CanisterIds {
    pub fn local_user_index(&self, env: &PocketIc, canister_id: impl Into<CanisterId>) -> CanisterId {
        self.subnet(env, canister_id.into()).local_user_index
    }

    pub fn local_group_index(&self, env: &PocketIc, canister_id: impl Into<CanisterId>) -> CanisterId {
        self.subnet(env, canister_id.into()).local_group_index
    }

    pub fn notifications(&self, env: &PocketIc, canister_id: impl Into<CanisterId>) -> CanisterId {
        self.subnet(env, canister_id.into()).notifications_canister
    }

    fn subnet(&self, env: &PocketIc, canister_id: CanisterId) -> Subnet {
        let subnet_id = env.topology().get_subnet(canister_id).unwrap();
        self.subnets.iter().find(|s| s.subnet_id == subnet_id).cloned().unwrap()
    }
}

impl Debug for CanisterIds {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut w = f.debug_struct("CanisterIds");
        w.field("user_index", &self.user_index.to_string());
        w.field("group_index", &self.group_index.to_string());
        w.field("notifications_index", &self.notifications_index.to_string());
        w.field("identity", &self.identity.to_string());
        w.field("online_users", &self.online_users.to_string());
        w.field("proposals_bot", &self.proposals_bot.to_string());
        w.field("airdrop_bot", &self.airdrop_bot.to_string());
        w.field("storage_index", &self.storage_index.to_string());
        w.field("cycles_dispenser", &self.cycles_dispenser.to_string());
        w.field("registry", &self.registry.to_string());
        w.field("escrow", &self.escrow.to_string());
        w.field("translations", &self.translations.to_string());
        w.field("event_relay", &self.event_relay.to_string());
        w.field("event_store", &self.event_store.to_string());
        w.field("sign_in_with_email", &self.sign_in_with_email.to_string());
        w.field("icp_ledger", &self.icp_ledger.to_string());
        w.field("chat_ledger", &self.chat_ledger.to_string());
        w.field("cycles_minting_canister", &self.cycles_minting_canister.to_string());
        w.finish()
    }
}

pub const T: Cycles = 1_000_000_000_000;
