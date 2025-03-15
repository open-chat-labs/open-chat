use crate::RuntimeState;
use types::TimestampMillis;

mod api_key;
mod c2c_bot_group_details;
mod c2c_can_issue_access_token_v2;
mod c2c_events_internal;
mod c2c_name_and_members;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod http_request;
mod invite_code;
mod local_user_index;
mod messages_by_message_index;
mod public_summary;
mod rules;
mod search_messages;
mod selected_initial;
mod selected_updates;
mod summary;
mod summary_updates;
mod thread_previews;
mod video_call_participants;

fn check_replica_up_to_date(latest_known_update: Option<TimestampMillis>, state: &RuntimeState) -> Result<(), TimestampMillis> {
    if let Some(ts) = latest_known_update {
        let now = state.env.now();
        if now < ts {
            return Err(now);
        }
    }
    Ok(())
}
