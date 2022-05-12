use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::update_permissions::{Response::*, *};
use ic_cdk_macros::update;
use types::PermissionsChanged;

#[update]
#[trace]
async fn update_permissions(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_permissions_impl(args, state))
}

fn update_permissions_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if !participant.role.can_change_permissions(&runtime_state.data.permissions) {
            return NotAuthorized;
        }

        runtime_state.data.permissions = args.permissions.clone();

        let now = runtime_state.env.now();
        let events = &mut runtime_state.data.events;

        events.push_event(
            ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                old_permissions: runtime_state.data.permissions.clone(),
                new_permissions: args.permissions,
                changed_by: participant.user_id,
            })),
            now,
        );

        handle_activity_notification(runtime_state);

        Success
    } else {
        CallerNotInGroup
    }
}
