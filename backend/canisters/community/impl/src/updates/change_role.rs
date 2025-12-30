use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update, jobs,
    model::events::CommunityEventInternal,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_role::*;
use group_community_common::ExpiringMember;
use types::{CommunityRole, CommunityRoleChanged, OCResult};

#[update(msgpack = true)]
#[trace]
async fn change_role(args: Args) -> Response {
    execute_update(|state| change_role_impl(args, state)).into()
}

fn change_role_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let member = state.get_calling_member(true)?;
    let caller_id = member.user_id;

    state.data.verify_not_frozen()?;

    let now = state.env.now();
    let result = state
        .data
        .members
        .change_role(caller_id, args.user_id, args.new_role, &state.data.permissions, now)?;

    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
    if let Some(gate_expiry) = state.data.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        if matches!(args.new_role, CommunityRole::Owner) {
            state.data.expiring_members.remove_member(args.user_id, None);
        } else if matches!(result.prev_role, CommunityRole::Owner) {
            state.data.expiring_members.push(ExpiringMember {
                expires: now + gate_expiry,
                channel_id: None,
                user_id: args.user_id,
            });
        }
    }

    let event = CommunityRoleChanged {
        user_ids: vec![args.user_id],
        old_role: result.prev_role,
        new_role: args.new_role,
        changed_by: caller_id,
    };
    state.push_community_event(CommunityEventInternal::RoleChanged(Box::new(event)));

    jobs::expire_members::start_job_if_required(state);

    handle_activity_notification(state);
    Ok(())
}
