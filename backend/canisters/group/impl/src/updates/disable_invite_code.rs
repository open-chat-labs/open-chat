use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::disable_invite_code::{Response::*, *};
use ic_cdk_macros::update;
use types::{GroupInviteCodeChange, GroupInviteCodeChanged};

#[update]
#[trace]
fn disable_invite_code(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(disable_invite_code_impl)
}

fn disable_invite_code_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.role.can_invite_users(&runtime_state.data.permissions) {
            runtime_state.data.invite_code_enabled = false;

            let now = runtime_state.env.now();
            runtime_state.data.events.push_event(
                ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
                    change: GroupInviteCodeChange::Disabled,
                    changed_by: participant.user_id,
                })),
                now,
            );

            handle_activity_notification(runtime_state);

            return Success;
        }
    }

    NotAuthorized
}
