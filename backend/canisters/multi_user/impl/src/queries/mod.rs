use crate::RuntimeState;
use types::TimestampMillis;

mod bio;
mod c2c_bot_chat_summary;
mod c2c_can_issue_access_token_v2;
mod c2c_groups_and_communities;
mod chit_events;
mod contacts;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod hot_group_exclusions;
mod http_request;
mod initial_state;
mod local_user_index;
mod message_activity_feed;
mod messages_by_message_index;
mod public_profile;
mod saved_crypto_accounts;
mod search_messages;
mod token_swap_status;
mod token_swaps;
mod updates;

fn check_replica_up_to_date(latest_known_update: Option<TimestampMillis>, state: &RuntimeState) -> Result<(), TimestampMillis> {
    if let Some(ts) = latest_known_update {
        let now = state.env.now();
        if now < ts {
            return Err(now);
        }
    }
    Ok(())
}
