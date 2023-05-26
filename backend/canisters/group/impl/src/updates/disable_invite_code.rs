use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::disable_invite_code::{Response::*, *};
use ic_cdk_macros::update;
use types::{GroupInviteCodeChange, GroupInviteCodeChanged};

#[update]
#[trace]
fn disable_invite_code(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| disable_invite_code_impl(args, state))
}

fn disable_invite_code_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        if member.role.can_invite_users(&state.data.chat.permissions) {
            let user_id = member.user_id;
            state.data.invite_code_enabled = false;

            let now = state.env.now();
            state.data.chat.events.push_main_event(
                ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
                    change: GroupInviteCodeChange::Disabled,
                    changed_by: user_id,
                })),
                args.correlation_id,
                now,
            );

            handle_activity_notification(state);

            return Success;
        }
    }

    NotAuthorized
}
