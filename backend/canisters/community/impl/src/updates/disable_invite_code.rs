use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, model::events::CommunityEventInternal, mutate_state,
    run_regular_jobs,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::disable_invite_code::*;
use oc_error_codes::OCErrorCode;
use types::{GroupInviteCodeChange, GroupInviteCodeChanged, OCResult, Timestamped};

#[update(msgpack = true)]
#[trace]
fn disable_invite_code(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(disable_invite_code_impl).into()
}

fn disable_invite_code_impl(state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if member.role().can_invite_users(&state.data.permissions) {
        let now = state.env.now();
        state.data.invite_code_enabled = Timestamped::new(false, now);
        state.data.events.push_event(
            CommunityEventInternal::InviteCodeChanged(Box::new(GroupInviteCodeChanged {
                change: GroupInviteCodeChange::Disabled,
                changed_by: member.user_id,
            })),
            now,
        );

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
