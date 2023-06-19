use crate::{
    activity_notifications::handle_activity_notification, model::events::CommunityEvent, mutate_state, run_regular_jobs,
    RuntimeState,
};
use canister_tracing_macros::trace;
use community_canister::disable_invite_code::{Response::*, *};
use ic_cdk_macros::update;
use types::{GroupInviteCodeChange, GroupInviteCodeChanged};

#[update]
#[trace]
fn disable_invite_code(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(disable_invite_code_impl)
}

fn disable_invite_code_impl(state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return CommunityFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if member.role.can_invite_users(&state.data.permissions) {
            state.data.invite_code_enabled = false;

            let now = state.env.now();
            state.data.events.push_event(
                CommunityEvent::InviteCodeChanged(Box::new(GroupInviteCodeChanged {
                    change: GroupInviteCodeChange::Disabled,
                    changed_by: member.user_id,
                })),
                now,
            );

            handle_activity_notification(state);

            return Success;
        }
    }

    NotAuthorized
}
