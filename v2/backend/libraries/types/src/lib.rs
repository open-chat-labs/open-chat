use candid::Principal;

mod avatar;
mod canister_creation_status;
mod canister_upgrade_status;
mod canister_wasm;
mod chat_id;
mod chat_summary;
mod confirmation_code_sms;
mod cycles;
mod event_index;
mod event_wrapper;
mod events;
mod field_too_long;
mod group_match;
mod http;
mod indexed_event;
mod message;
mod message_content;
mod message_id;
mod message_index;
mod message_match;
mod notifications;
mod participant;
mod reactions;
mod role;
mod subscription;
mod user_id;
mod user_summary;
mod version;

pub use avatar::*;
pub use canister_creation_status::*;
pub use canister_upgrade_status::*;
pub use canister_wasm::*;
pub use chat_id::*;
pub use chat_summary::*;
pub use confirmation_code_sms::*;
pub use cycles::*;
pub use event_index::*;
pub use event_wrapper::*;
pub use events::*;
pub use field_too_long::*;
pub use group_match::*;
pub use http::*;
pub use indexed_event::*;
pub use message::*;
pub use message_content::*;
pub use message_id::*;
pub use message_index::*;
pub use message_match::*;
pub use notifications::*;
pub use participant::*;
pub use reactions::*;
pub use role::*;
pub use subscription::*;
pub use user_id::*;
pub use user_summary::*;
pub use version::*;

pub mod v1_message;

pub type CanisterId = Principal;
pub type Milliseconds = u64;
pub type TimestampMillis = u64;
pub type TimestampNanos = u64;
