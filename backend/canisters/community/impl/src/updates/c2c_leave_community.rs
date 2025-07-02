use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update, model::events::CommunityEventInternal,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_leave_community::*;
use oc_error_codes::OCErrorCode;
use types::{MemberLeft, OCResult};

// Called via the user's user canister
#[update(msgpack = true)]
#[trace]
fn c2c_leave_community(args: Args) -> Response {
    execute_update(|state| c2c_leave_community_impl(args, state)).into()
}

fn c2c_leave_community_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(false)?;

    if member.suspended().value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    if (member.role().is_owner() && state.data.members.owners().len() <= 1)
        || !state.data.channels.can_leave_all_channels(member.user_id)
    {
        return Err(OCErrorCode::LastOwnerCannotLeave.into());
    }

    let now = state.env.now();
    state
        .data
        .remove_user_from_community(member.user_id, Some(args.principal), now);

    state.push_community_event(CommunityEventInternal::MemberLeft(Box::new(MemberLeft {
        user_id: member.user_id,
    })));

    handle_activity_notification(state);
    Ok(())
}
