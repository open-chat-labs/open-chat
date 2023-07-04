use crate::{
    activity_notifications::handle_activity_notification,
    model::{
        channels::{AddDefaultChannelResult, RemoveDefaultChannelResult},
        events::CommunityEvent,
    },
    mutate_state, run_regular_jobs, RuntimeState,
};
use canister_tracing_macros::trace;
use community_canister::manage_default_channels::{Response::*, *};
use ic_cdk_macros::update;
use types::DefaultChannelsChanged;

#[update]
#[trace]
fn manage_default_channels(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| manage_default_channels_impl(args, state))
}

fn manage_default_channels_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if !member.role.can_update_details(&state.data.permissions) {
            return NotAuthorized;
        }

        let mut failed_channels = FailedChannels {
            not_found: Vec::new(),
            private: Vec::new(),
        };

        let mut added = Vec::new();
        let mut removed = Vec::new();

        let now = state.env.now();

        for channel_id in args.to_add.iter() {
            match state.data.channels.add_default_channel(*channel_id, now) {
                AddDefaultChannelResult::Added => added.push(*channel_id),
                AddDefaultChannelResult::AlreadyDefault => (),
                AddDefaultChannelResult::Private => failed_channels.private.push(*channel_id),
                AddDefaultChannelResult::NotFound => failed_channels.not_found.push(*channel_id),
            }
        }

        for channel_id in args.to_remove.iter() {
            match state.data.channels.remove_default_channel(channel_id, now) {
                RemoveDefaultChannelResult::Removed => removed.push(*channel_id),
                RemoveDefaultChannelResult::NotDefault => (),
                RemoveDefaultChannelResult::NotFound => failed_channels.not_found.push(*channel_id),
            }
        }

        let changed = !added.is_empty() || !removed.is_empty();

        if changed {
            let event = DefaultChannelsChanged {
                added,
                removed,
                changed_by: member.user_id,
            };

            state
                .data
                .events
                .push_event(CommunityEvent::DefaultChannelsChanged(Box::new(event)), now);

            handle_activity_notification(state);
        }

        if failed_channels.not_found.is_empty() && failed_channels.private.is_empty() {
            Success
        } else if changed {
            PartialSucesss(failed_channels)
        } else {
            Failed(failed_channels)
        }
    } else {
        UserNotInCommunity
    }
}
