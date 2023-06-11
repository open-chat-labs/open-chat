use candid::{CandidType, Principal};
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

mod avatar;
mod bots;
mod canister_upgrade_status;
mod canister_wasm;
mod channel_summary;
mod chat_id;
mod chat_summary;
mod community_id;
mod community_member;
mod community_roles;
mod community_summary;
mod cryptocurrency;
mod cycles;
mod deleted_group_info;
mod diamond_membership;
mod error;
mod event_index;
mod event_result;
mod event_wrapper;
mod events;
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
mod phone_number;
mod polls;
mod proposals;
mod range_set;
mod reactions;
mod referral_codes;
mod registration_fee;
mod subscription;
mod suspension_duration;
mod thread_preview;
mod thread_summary;
mod timestamped;
mod user;
mod user_summary;
mod version;

pub use crate::range_set::*;
pub use avatar::*;
pub use bots::*;
pub use canister_upgrade_status::*;
pub use canister_wasm::*;
pub use channel_summary::*;
pub use chat_id::*;
pub use chat_summary::*;
pub use community_id::*;
pub use community_member::*;
pub use community_roles::*;
pub use community_summary::*;
pub use cryptocurrency::*;
pub use cycles::*;
pub use deleted_group_info::*;
pub use diamond_membership::*;
pub use error::*;
pub use event_index::*;
pub use event_result::*;
pub use event_wrapper::*;
pub use events::*;
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
pub use phone_number::*;
pub use polls::*;
pub use proposals::*;
pub use reactions::*;
pub use referral_codes::*;
pub use registration_fee::*;
pub use subscription::*;
pub use suspension_duration::*;
pub use thread_preview::*;
pub use thread_summary::*;
pub use timestamped::*;
pub use user::*;
pub use user_summary::*;
pub use version::*;

pub type AccessorId = Principal;
pub type CanisterId = Principal;
pub type ChannelId = u128;
pub type FileId = u128;
pub type Hash = [u8; 32];
pub type ICP = Tokens;
pub type Milliseconds = u64;
pub type NnsNeuronId = u64;
pub type ProposalId = u64;
pub type SnsNeuronId = [u8; 32];
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;

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

pub fn is_empty_slice<T>(value: &[T]) -> bool {
    value.is_empty()
}

pub fn is_empty_hashset<T>(value: &HashSet<T>) -> bool {
    value.is_empty()
}

pub fn is_empty_btreemap<K, V>(value: &BTreeMap<K, V>) -> bool {
    value.is_empty()
}

pub fn is_default<T: Default + Eq>(value: &T) -> bool {
    *value == Default::default()
}
