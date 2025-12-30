use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_channel_role::*;
use group_chat_core::GroupRoleInternal;
use group_community_common::ExpiringMember;
use types::{GroupRole, OCResult};

#[update(msgpack = true)]
#[trace]
fn change_channel_role(args: Args) -> Response {
    execute_update(|state| change_channel_role_impl(args, state)).into()
}

fn change_channel_role_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let now = state.env.now();

    let result = channel.chat.change_role(member.user_id, args.user_id, args.new_role, now)?;

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

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
