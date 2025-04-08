use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_channel_role::{Response::*, *};
use group_chat_core::GroupRoleInternal;
use group_community_common::ExpiringMember;
use oc_error_codes::{OCError, OCErrorCode};
use types::GroupRole;

#[update(msgpack = true)]
#[trace]
fn change_channel_role(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| change_channel_role_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn change_channel_role_impl(args: Args, state: &mut RuntimeState) -> Result<(), OCError> {
    state.data.verify_not_frozen()?;

    let caller = state.env.caller();
    let member = state.data.members.get_then_verify(caller)?;

    if let Some(channel) = state.data.channels.get_mut(&args.channel_id) {
        let now = state.env.now();

        let result = channel
            .chat
            .change_role(member.user_id, args.user_id, args.new_role, false, false, now)?;

        // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
        if let Some(gate_expiry) = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
            if matches!(args.new_role, GroupRole::Owner) {
                state.data.expiring_members.remove_member(args.user_id, Some(args.channel_id));
            } else if matches!(result.prev_role, GroupRoleInternal::Owner) {
                state.data.expiring_members.push(ExpiringMember {
                    expires: now + gate_expiry,
                    channel_id: Some(args.channel_id),
                    user_id: args.user_id,
                });
            }
        }

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::ChatNotFound.into())
    }
}
