use crate::RuntimeState;
use types::TimestampMillis;

mod c2c_can_issue_access_token;
mod c2c_can_issue_access_token_for_channel;
mod channel_summary;
mod channel_summary_updates;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod explore_channels;
mod http_request;
mod invite_code;
mod local_user_index;
mod lookup_members;
mod messages_by_message_index;
mod search_channel;
mod selected_channel_initial;
mod selected_channel_updates;
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
