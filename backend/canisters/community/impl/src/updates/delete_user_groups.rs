use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::delete_user_groups::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn delete_user_groups(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| delete_user_groups_impl(args, state)).into()
}

fn delete_user_groups_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if member.role().can_manage_user_groups(&state.data.permissions) {
        let now = state.env.now();

        let mut updated = false;
        for user_group_id in args.user_group_ids {
            if state.data.members.delete_user_group(user_group_id, now) {
                updated = true;
            }
        }
        if updated {
            handle_activity_notification(state);
        }
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
