use candid::{CandidType, Principal};
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

mod avatar;
mod bots;
mod build_version;
mod canister_upgrade_status;
mod canister_wasm;
mod channel_summary;
mod chat;
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
mod phone_number;
mod polls;
mod proposals;
mod range_set;
mod reactions;
mod referral_codes;
mod registration_fee;
mod relayed_args;
mod source_group;
mod subscription;
mod suspension_duration;
mod thread_preview;
mod thread_summary;
mod timestamped;
mod user;
mod user_groups;
mod user_summary;
mod version;
mod versioned;

pub use crate::range_set::*;
pub use avatar::*;
pub use bots::*;
pub use build_version::*;
pub use canister_upgrade_status::*;
pub use canister_wasm::*;
pub use channel_summary::*;
pub use chat::*;
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
pub use phone_number::*;
pub use polls::*;
pub use proposals::*;
pub use reactions::*;
pub use referral_codes::*;
pub use registration_fee::*;
pub use relayed_args::*;
pub use source_group::*;
pub use subscription::*;
pub use suspension_duration::*;
pub use thread_preview::*;
pub use thread_summary::*;
pub use timestamped::*;
pub use user::*;
pub use user_groups::*;
pub use user_summary::*;
pub use version::*;
pub use versioned::*;

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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResultLowercase<T, E> {
    #[serde(rename = "ok")]
    Ok(T),
    #[serde(rename = "err")]
    Err(E),
}

pub fn is_empty_slice<T>(value: &[T]) -> bool {
    value.is_empty()
}

pub fn is_empty_hashmap<K, V>(value: &HashMap<K, V>) -> bool {
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

// TODO remove this after next release cycle
pub fn local_user_index_canister_id(canister_id: CanisterId) -> CanisterId {
    let bytes = canister_id.as_slice();
    if bytes > &[0, 0, 0, 0, 2, 32, 0, 0, 1, 1] && bytes < &[0, 0, 0, 0, 2, 48, 0, 0, 1, 1] {
        return CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap();
    }
    if bytes > &[0, 0, 0, 0, 0, 160, 0, 0, 1, 1] && bytes < &[0, 0, 0, 0, 0, 176, 0, 0, 1, 1] {
        return CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap();
    }
    // This will only be reached during tests + local development
    CanisterId::from_text("be2us-64aaa-aaaaa-qaabq-cai").unwrap()
}

#[test]
fn test_subnet_eq6en() {
    let index = local_user_index_canister_id(CanisterId::from_text("2rgzm-4iaaa-aaaaf-aaa5a-cai").unwrap());

    assert_eq!(index, CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap());
}

#[test]
fn test_subnet_2fq7c() {
    let index = local_user_index_canister_id(CanisterId::from_text("dgegb-daaaa-aaaar-arlhq-cai").unwrap());

    assert_eq!(index, CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap());
}
