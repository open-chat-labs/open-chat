use crate::{
    model::{events::CommunityEvent, members::CommunityMemberInternal},
    mutate_state, read_state, RuntimeState,
};
use candid::Principal;
use canister_tracing_macros::trace;
use community_canister::remove_member::{Response::*, *};
use ic_cdk_macros::update;
use types::{MembersRemoved, UserId, UsersBlocked};
use user_canister::c2c_remove_from_group;

#[update]
#[trace]
async fn block_user(args: community_canister::block_user::Args) -> community_canister::block_user::Response {
    if !read_state(|state| state.data.is_public) {
        return community_canister::block_user::Response::CommunityNotPublic;
    }

    let remove_response = remove_member_impl(args.user_id, true).await;
    remove_response.into()
}

#[update]
#[trace]
async fn remove_member(args: Args) -> Response {
    remove_member_impl(args.user_id, false).await
}

async fn remove_member_impl(user_id: UserId, block: bool) -> Response {
    // If authorized remove the member from the group
    let prepare_result = match mutate_state(|state| prepare(block, user_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Try to remove the member from the user canister
    let c2c_remove_from_group_args = c2c_remove_from_group::Args {
        removed_by: prepare_result.removed_by,
        blocked: block,
        group_name: prepare_result.group_name,
        public: prepare_result.public,
    };

    let response = match user_canister_c2c_client::c2c_remove_from_group(user_id.into(), &c2c_remove_from_group_args).await {
        Ok(c2c_remove_from_group::Response::Success) => {
            // Push a MembersRemoved event
            mutate_state(|state| commit(block, user_id, prepare_result.removed_by, state));
            return Success;
        }
        Ok(c2c_remove_from_group::Response::CannotRemoveUser) => CannotRemoveUser,
        Err(error) => InternalError(format!("{error:?}")),
    };

    // Put the member back
    mutate_state(|state| {
        rollback(
            block,
            prepare_result.principal_to_remove,
            prepare_result.member_to_remove,
            state,
        )
    });

    response
}

struct PrepareResult {
    removed_by: UserId,
    group_name: String,
    public: bool,
    member_to_remove: CommunityMemberInternal,
    principal_to_remove: Principal,
}

fn prepare(block: bool, user_id: UserId, state: &mut RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if member.user_id == user_id {
            Err(CannotRemoveSelf)
        } else {
            // Check if the caller is authorized to remove the user
            let principal_to_remove = match state.data.members.get(user_id.into()) {
                None => return Err(UserNotInCommunity),
                Some(member_to_remove) => {
                    if member
                        .role
                        .can_remove_members_with_role(member_to_remove.role, &state.data.permissions)
                    {
                        state
                            .data
                            .members
                            .get_principal(&user_id)
                            .expect("missing principal for member")
                    } else {
                        return Err(NotAuthorized);
                    }
                }
            };

            // Remove the user from the group
            let removed_by = member.user_id;
            let member_to_remove = state
                .data
                .members
                .remove_by_principal(&principal_to_remove)
                .expect("user must be a member");

            if block {
                // Also block the user
                state.data.members.block(user_id);
            }

            Ok(PrepareResult {
                removed_by,
                group_name: state.data.name.clone(),
                public: state.data.is_public,
                member_to_remove,
                principal_to_remove,
            })
        }
    } else {
        Err(CallerNotInCommunity)
    }
}

fn commit(block: bool, user_id: UserId, removed_by: UserId, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let event = if block {
        let event = UsersBlocked {
            user_ids: vec![user_id],
            blocked_by: removed_by,
        };

        CommunityEvent::UsersBlocked(Box::new(event))
    } else {
        let event = MembersRemoved {
            user_ids: vec![user_id],
            removed_by,
        };
        CommunityEvent::MembersRemoved(Box::new(event))
    };

    state.data.events.push_event(event, now);
    Success
}

fn rollback(block: bool, principal: Principal, member: CommunityMemberInternal, state: &mut RuntimeState) {
    if block {
        state.data.members.unblock(&member.user_id);
    }

    state.data.members.try_undo_remove(principal, member);
}
