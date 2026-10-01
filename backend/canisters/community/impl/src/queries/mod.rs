use crate::RuntimeState;
use crate::model::channels::Channel;
use oc_error_codes::OCErrorCode;
use types::TimestampMillis;

mod active_proposal_tallies;
mod c2c_bot_channel_details;
mod c2c_bot_community_events;
mod c2c_bot_community_summary;
mod c2c_bot_members;
mod c2c_can_issue_access_token;
mod channel_members;
mod channel_summary;
mod channel_summary_updates;
mod community_events;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod explore_channels;
mod http_request;
mod invite_code;
mod local_user_index;
mod lookup_channel_members;
mod lookup_members;
mod members;
mod messages_by_message_index;
mod search_channel;
mod search_members;
mod selected_channel_initial;
mod selected_channel_updates;
mod selected_initial;
mod selected_updates;
mod summary;
mod summary_updates;
mod thread_previews;
mod video_call_participants;
mod webhook;

fn check_replica_up_to_date(latest_known_update: Option<TimestampMillis>, state: &RuntimeState) -> Result<(), TimestampMillis> {
    if let Some(ts) = latest_known_update {
        let now = state.env.now();
        if now < ts {
            return Err(now);
        }
    }
    Ok(())
}

// Checks that the caller can see the community's details. The caller is only read if the answer
// depends on who they are, since a query which doesn't read its caller can be served from the
// replica's cache to whoever makes it.
fn verify_community_is_accessible(invite_code: Option<u64>, state: &RuntimeState) -> Result<(), OCErrorCode> {
    if state.data.is_public.value || state.data.is_invite_code_valid(invite_code) {
        Ok(())
    } else {
        state.data.verify_is_accessible(state.env.caller(), None)
    }
}

// As for `verify_community_is_accessible`, but that the caller can see the channel's details
fn verify_channel_is_accessible(channel: &Channel, state: &RuntimeState) -> Result<(), OCErrorCode> {
    if state.data.is_public.value && channel.chat.is_public.value {
        return Ok(());
    }
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;
    channel.chat.verify_is_accessible(state.data.members.lookup_user_id(caller))
}
