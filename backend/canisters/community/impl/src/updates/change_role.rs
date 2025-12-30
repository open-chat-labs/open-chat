use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update, jobs,
    model::events::CommunityEventInternal,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_role::*;
use group_community_common::ExpiringMember;
use oc_error_codes::OCError;
use std::collections::HashMap;
use types::{CommunityRole, CommunityRoleChanged, OCResult, UserId};

#[update(msgpack = true)]
#[trace]
async fn change_role(args: Args) -> Response {
    match execute_update(|state| change_role_impl(args, state)) {
        Ok(errors) => {
            if errors.is_empty() {
                Response::Success
            } else {
                Response::PartialSuccess(errors)
            }
        }
        Err(err) => Response::Error(err),
    }
}

fn change_role_impl(mut args: Args, state: &mut RuntimeState) -> OCResult<HashMap<UserId, OCError>> {
    if args.user_ids.is_empty() {
        args.user_ids.push(args.user_id);
    }

    let member = state.get_calling_member(true)?;
    let caller_id = member.user_id;

    state.data.verify_not_frozen()?;

    let mut results = HashMap::new();

    let now = state.env.now();

    for user_id in &args.user_ids {
        match state
            .data
            .members
            .change_role(caller_id, *user_id, args.new_role, &state.data.permissions, now)
        {
            Ok(success) => {
                results.insert(*user_id, Ok(success.prev_role));
            }
            Err(error) => {
                results.insert(*user_id, Err(error));
            }
        }
    }

    let mut successes = Vec::new();
    let mut failures = HashMap::new();

    for (user_id, result) in results {
        match result {
            Ok(prev_role) => successes.push((user_id, prev_role)),
            Err(error) => {
                _ = failures.insert(user_id, error);
            }
        }
    }

    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
    if let Some(gate_expiry) = state.data.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        for (user_id, prev_role) in successes.iter() {
            if matches!(args.new_role, CommunityRole::Owner) {
                state.data.expiring_members.remove_member(*user_id, None);
            } else if matches!(prev_role, CommunityRole::Owner) {
                state.data.expiring_members.push(ExpiringMember {
                    expires: now + gate_expiry,
                    channel_id: None,
                    user_id: *user_id,
                });
            }
        }
    }

    if !successes.is_empty() {
        let event = CommunityRoleChanged {
            user_ids: successes.iter().map(|(user_id, _)| *user_id).collect(),
            old_role: successes[0].1,
            new_role: args.new_role,
            changed_by: caller_id,
        };
        state.push_community_event(CommunityEventInternal::RoleChanged(Box::new(event)));
    }

    jobs::expire_members::start_job_if_required(state);

    handle_activity_notification(state);

    Ok(failures)
}
