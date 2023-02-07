use candid::Principal;
use ic_ledger_types::Tokens;

mod avatar;
mod bots;
mod canister_upgrade_status;
mod canister_wasm;
mod challenge;
mod chat_id;
mod chat_summary;
mod confirmation_code_sms;
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
mod frozen_group_info;
mod group_activity;
mod group_match;
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
mod participant;
mod phone_number;
mod polls;
mod proposals;
mod range_set;
mod reactions;
mod registration_fee;
mod role;
mod subscription;
mod suspension_duration;
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
pub use challenge::*;
pub use chat_id::*;
pub use chat_summary::*;
pub use confirmation_code_sms::*;
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
pub use frozen_group_info::*;
pub use group_activity::*;
pub use group_match::*;
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
pub use participant::*;
pub use phone_number::*;
pub use polls::*;
pub use proposals::*;
pub use reactions::*;
pub use registration_fee::*;
pub use role::*;
pub use subscription::*;
pub use suspension_duration::*;
pub use thread_summary::*;
pub use timestamped::*;
pub use user::*;
pub use user_summary::*;
pub use version::*;

pub type CanisterId = Principal;
pub type ICP = Tokens;
pub type Milliseconds = u64;
pub type NnsNeuronId = u64;
pub type ProposalId = u64;
pub type Salt = [u8; 32];
pub type SnsNeuronId = [u8; 32];
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;

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
