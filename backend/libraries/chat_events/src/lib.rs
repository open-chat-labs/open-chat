mod chat_event_internal;
mod chat_events;
mod chat_events_list;
mod expiring_events;
mod last_updated_timestamps;

pub use crate::chat_event_internal::*;
pub use crate::chat_events::*;
pub use crate::chat_events_list::*;

fn incr(counter: &mut u64) {
    *counter = counter.saturating_add(1);
}

fn decr(counter: &mut u64) {
    *counter = counter.saturating_sub(1);
}
