use crate::nns::Tokens;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

mod access_tokens;
mod achievement;
mod airdrop_config;
mod avatar;
mod bots;
mod build_version;
pub mod c2c_can_issue_access_token;
pub mod c2c_install_bot;
pub mod c2c_uninstall_bot;
mod caller;
mod canister_upgrade_status;
mod canister_wasm;
mod channel_id;
mod channel_summary;
mod chat;
mod chat_id;
mod chat_summary;
mod chit;
mod claims;
mod community_id;
mod community_member;
mod community_roles;
mod community_summary;
mod cryptocurrency;
mod cycles;
mod delegation;
mod deleted_group_info;
mod diamond_membership;
mod error;
mod event_index;
mod event_result;
mod event_wrapper;
mod events;
mod exchange_id;
mod exchanges;
mod field_invalid;
mod file;
mod file_status;
mod frozen_group_info;
mod gated_groups;
mod group_activity;
mod group_match;
mod group_member;
mod group_roles;
mod http;
mod indexed_event;
mod mention;
mod message;
mod message_content;
mod message_id;
mod message_index;
mod message_match;
mod notifications;
mod option;
mod p2p_swaps;
mod phone_number;
mod pin_number;
mod polls;
mod proof_of_uniqueness;
mod proposals;
mod range_set;
mod reactions;
mod referrals;
mod registration_fee;
mod relayed_args;
mod source_group;
mod subscription;
mod suspension;
mod thread_preview;
mod thread_summary;
mod timestamped;
mod update_user_principal;
mod user;
mod user_groups;
mod user_summary;
mod version;
mod versioned;
mod video_calls;

pub use access_tokens::*;
pub use achievement::*;
pub use airdrop_config::*;
pub use avatar::*;
pub use bots::*;
pub use build_version::*;
pub use caller::*;
pub use canister_upgrade_status::*;
pub use canister_wasm::*;
pub use channel_id::*;
pub use channel_summary::*;
pub use chat::*;
pub use chat_id::*;
pub use chat_summary::*;
pub use chit::*;
pub use claims::*;
pub use community_id::*;
pub use community_member::*;
pub use community_roles::*;
pub use community_summary::*;
pub use cryptocurrency::*;
pub use cycles::*;
pub use delegation::*;
pub use deleted_group_info::*;
pub use diamond_membership::*;
pub use error::*;
pub use event_index::*;
pub use event_result::*;
pub use event_wrapper::*;
pub use events::*;
pub use exchange_id::*;
pub use exchanges::*;
pub use field_invalid::*;
pub use file::*;
pub use file_status::*;
pub use frozen_group_info::*;
pub use gated_groups::*;
pub use group_activity::*;
pub use group_match::*;
pub use group_member::*;
pub use group_roles::*;
pub use http::*;
pub use indexed_event::*;
pub use mention::*;
pub use message::*;
pub use message_content::*;
pub use message_id::*;
pub use message_index::*;
pub use message_match::*;
pub use notifications::*;
pub use option::*;
pub use p2p_swaps::*;
pub use phone_number::*;
pub use pin_number::*;
pub use polls::*;
pub use proof_of_uniqueness::*;
pub use proposals::*;
pub use range_set::*;
pub use reactions::*;
pub use referrals::*;
pub use registration_fee::*;
pub use relayed_args::*;
pub use source_group::*;
pub use subscription::*;
pub use suspension::*;
pub use thread_preview::*;
pub use thread_summary::*;
pub use timestamped::*;
use ts_export::ts_export;
pub use update_user_principal::*;
pub use user::*;
pub use user_groups::*;
pub use user_summary::*;
pub use version::*;
pub use versioned::*;
pub use video_calls::*;

pub type AccessorId = Principal;
pub type CanisterId = Principal;
pub type FileId = u128;
pub type Hash = [u8; 32];
pub type ICP = Tokens;
pub type Milliseconds = u64;
pub type Nanoseconds = u64;
pub type NnsNeuronId = u64;
pub type ProposalId = u64;
pub type SnsNeuronId = [u8; 32];
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct Empty {}

pub trait PushIfNotContains<T> {
    fn push_if_not_contains(&mut self, item: T) -> bool;
}

impl<T: PartialEq> PushIfNotContains<T> for Vec<T> {
    fn push_if_not_contains(&mut self, item: T) -> bool {
        if !self.contains(&item) {
            self.push(item);
            true
        } else {
            false
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResultLowercase<T, E> {
    #[serde(rename = "ok")]
    Ok(T),
    #[serde(rename = "err")]
    Err(E),
}

pub fn is_default<T: Default + PartialEq>(value: &T) -> bool {
    *value == Default::default()
}
