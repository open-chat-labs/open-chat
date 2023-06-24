use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEvent, mutate_state, run_regular_jobs,
    RuntimeState,
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

        let added: Vec<_> = args
            .to_add
            .into_iter()
            .filter(|c| state.data.channels.add_default_channel(*c))
            .collect();

        let removed: Vec<_> = args
            .to_remove
            .into_iter()
            .filter(|c| state.data.channels.remove_default_channel(c))
            .collect();

        if !added.is_empty() || !removed.is_empty() {
            let now = state.env.now();

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

        Success
    } else {
        UserNotInCommunity
    }
}
