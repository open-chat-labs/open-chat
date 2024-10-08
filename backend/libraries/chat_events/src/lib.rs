mod chat_event_internal;
mod chat_events;
mod chat_events_list;
pub mod deep_message_links;
mod events_map;
mod expiring_events;
mod last_updated_timestamps;
mod message_content_internal;
mod search_index;

pub use crate::chat_event_internal::*;
pub use crate::chat_events::*;
pub use crate::chat_events_list::*;
pub use crate::events_map::*;
pub use crate::message_content_internal::*;

fn incr(counter: &mut u64) {
    *counter = counter.saturating_add(1);
}

fn decr(counter: &mut u64) {
    *counter = counter.saturating_sub(1);
}
