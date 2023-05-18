use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::remove_participant::{Response::*, *};
use group_members::GroupMemberInternal;
use ic_cdk_macros::update;
use types::{MembersRemoved, UserId, UsersBlocked};
use user_canister::c2c_remove_from_group;

#[update]
#[trace]
async fn block_user(args: group_canister::block_user::Args) -> group_canister::block_user::Response {
    if !read_state(|state| state.data.group_chat_core.is_public) {
        return group_canister::block_user::Response::GroupNotPublic;
    }

    let remove_response = remove_participant_impl(args.user_id, args.correlation_id, true).await;
    remove_response.into()
}

#[update]
#[trace]
async fn remove_participant(args: Args) -> Response {
    remove_participant_impl(args.user_id, args.correlation_id, false).await
}

async fn remove_participant_impl(user_id: UserId, correlation_id: u64, block: bool) -> Response {
    run_regular_jobs();

    // If authorized remove the participant from the group
    let prepare_result = match mutate_state(|state| prepare(block, user_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Try to remove the participant from the user canister
    let c2c_remove_from_group_args = c2c_remove_from_group::Args {
        removed_by: prepare_result.removed_by,
        blocked: block,
        group_name: prepare_result.group_name,
        public: prepare_result.public,
    };

    let response = match user_canister_c2c_client::c2c_remove_from_group(user_id.into(), &c2c_remove_from_group_args).await {
        Ok(c2c_remove_from_group::Response::Success) => {
            // Push a ParticipantsRemoved event
            mutate_state(|state| commit(block, user_id, correlation_id, prepare_result.removed_by, state));
            return Success;
        }
        Ok(c2c_remove_from_group::Response::CannotRemoveUser) => CannotRemoveUser,
        Err(error) => InternalError(format!("{error:?}")),
    };

    // Put the participant back
    mutate_state(|state| rollback(block, prepare_result.participant_to_remove, state));

    response
}

struct PrepareResult {
    removed_by: UserId,
    group_name: String,
    public: bool,
    participant_to_remove: GroupMemberInternal,
}

fn prepare(block: bool, user_id: UserId, runtime_state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = runtime_state.env.caller();
    if let Some(member) = runtime_state.data.get_member(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if member.user_id == user_id {
            Err(CannotRemoveSelf)
        } else {
            // Check if the caller is authorized to remove the user
            match runtime_state.data.group_chat_core.members.get(&user_id) {
                None => return Err(UserNotInGroup),
                Some(participant_to_remove) => {
                    if !member.role.can_remove_members_with_role(
                        participant_to_remove.role,
                        &runtime_state.data.group_chat_core.permissions,
                    ) {
                        return Err(NotAuthorized);
                    }
                }
            };

            // Remove the user from the group
            let removed_by = member.user_id;
            let participant_to_remove = runtime_state.remove_member(user_id).expect("user must be a member");

            if block {
                // Also block the user
                runtime_state.data.group_chat_core.members.block(user_id);
            }

            Ok(PrepareResult {
                removed_by,
                group_name: runtime_state.data.group_chat_core.name.clone(),
                public: runtime_state.data.group_chat_core.is_public,
                participant_to_remove,
            })
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(block: bool, user_id: UserId, correlation_id: u64, removed_by: UserId, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let event = if block {
        let event = UsersBlocked {
            user_ids: vec![user_id],
            blocked_by: removed_by,
        };

        ChatEventInternal::UsersBlocked(Box::new(event))
    } else {
        let event = MembersRemoved {
            user_ids: vec![user_id],
            removed_by,
        };
        ChatEventInternal::ParticipantsRemoved(Box::new(event))
    };

    runtime_state
        .data
        .group_chat_core
        .events
        .push_main_event(event, correlation_id, now);

    handle_activity_notification(runtime_state);
    Success
}

fn rollback(block: bool, member: GroupMemberInternal, runtime_state: &mut RuntimeState) {
    if block {
        runtime_state.data.group_chat_core.members.unblock(&member.user_id);
    }

    runtime_state.data.group_chat_core.members.try_undo_remove(member);
}
