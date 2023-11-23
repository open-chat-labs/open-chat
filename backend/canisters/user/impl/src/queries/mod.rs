use crate::RuntimeState;
use types::TimestampMillis;

pub mod bio;
pub mod contacts;
pub mod deleted_message;
pub mod events;
pub mod events_by_index;
pub mod events_window;
pub mod hot_group_exclusions;
pub mod http_request;
pub mod initial_state;
pub mod messages_by_message_index;
pub mod public_profile;
pub mod saved_crypto_accounts;
pub mod search_messages;
pub mod token_swap_status;
pub mod updates;

fn check_replica_up_to_date(latest_known_update: Option<TimestampMillis>, state: &RuntimeState) -> Result<(), TimestampMillis> {
    if let Some(ts) = latest_known_update {
        let now = state.env.now();
        if now < ts {
            return Err(now);
        }
    }
    Ok(())
}
