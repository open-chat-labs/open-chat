use event_store_types::Event;

mod chat_event_internal;
mod chat_events;
mod chat_events_list;
mod events_map;
mod expiring_events;
mod hybrid_map;
mod last_updated_timestamps;
mod legacy_heap_entries;
mod message_content_internal;
mod message_event_indexes;
mod message_ids;
mod metrics;
mod per_user_metrics;
mod search_index;
mod stable_memory;
mod user_ids;
mod user_ids_migration;

pub use crate::chat_event_internal::*;
pub use crate::chat_events::*;
pub use crate::chat_events_list::*;
pub use crate::events_map::*;
pub use crate::message_content_internal::*;
pub use crate::metrics::*;
pub use crate::user_ids::UserIdUpdater;
pub use crate::user_ids_migration::*;

pub trait EventPusher {
    fn push(&mut self, event: Event);
}

pub struct NullEventPusher;

impl EventPusher for NullEventPusher {
    fn push(&mut self, _event: Event) {}
}
