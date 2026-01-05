use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update, jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::change_role::*;
use group_chat_core::GroupRoleInternal;
use group_community_common::ExpiringMember;
use oc_error_codes::OCError;
use std::collections::HashMap;
use types::{GroupRole, OCResult, UserId};

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
    let caller_id = member.user_id();

    state.data.verify_not_frozen()?;

    let now = state.env.now();
    let results = state.data.chat.change_role(caller_id, args.user_ids, args.new_role, now);

    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
    if let Some(gate_expiry) = state.data.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        for (user_id, prev_role) in results.users.iter().filter_map(|(user_id, result)| match result {
            Ok(role) => Some((*user_id, *role)),
            Err(_) => None,
        }) {
            if matches!(args.new_role, GroupRole::Owner) {
                state.data.expiring_members.remove_member(user_id, None);
            } else if matches!(prev_role, GroupRoleInternal::Owner) {
                state.data.expiring_members.push(ExpiringMember {
                    expires: now + gate_expiry,
                    channel_id: None,
                    user_id,
                });
            }
        }
    }

    jobs::expire_members::start_job_if_required(state);

    state.push_bot_notification(results.bot_notification);
    handle_activity_notification(state);

    Ok(results
        .users
        .into_iter()
        .filter_map(|(user_id, result)| match result {
            Ok(_) => None,
            Err(err) => Some((user_id, err)),
        })
        .collect())
}
