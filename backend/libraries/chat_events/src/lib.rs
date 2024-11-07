mod chat_event_internal;
mod chat_events;
mod chat_events_list;
pub mod deep_message_links;
mod events_map;
mod expiring_events;
mod hybrid_map;
mod last_updated_timestamps;
mod message_content_internal;
mod search_index;
mod stable_storage;

pub use crate::chat_event_internal::*;
pub use crate::chat_events::*;
pub use crate::chat_events_list::*;
pub use crate::events_map::*;
pub use crate::message_content_internal::*;
pub use crate::stable_storage::key::*;

fn incr(counter: &mut u32) {
    *counter = counter.saturating_add(1);
}

fn decr(counter: &mut u32) {
    *counter = counter.saturating_sub(1);
}
