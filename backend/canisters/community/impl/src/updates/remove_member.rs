use std::collections::HashMap;

use crate::{
    model::{events::CommunityEvent, members::CommunityMemberInternal},
    mutate_state, read_state, RuntimeState,
};
use candid::Principal;
use canister_tracing_macros::trace;
use community_canister::remove_member::{Response::*, *};
use group_members::GroupMemberInternal;
use ic_cdk_macros::update;
use types::{CommunityGroupId, MembersRemoved, UserId, UsersBlocked};
use user_canister::c2c_remove_from_community;

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
    // If authorized remove the member from the community
    let prepare_result = match mutate_state(|state| prepare(block, user_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // Try to remove the member from the user canister
    let c2c_remove_from_community_args = c2c_remove_from_community::Args {
        removed_by: prepare_result.removed_by,
        blocked: block,
        community_name: prepare_result.community_name,
        public: prepare_result.public,
    };

    let response =
        match user_canister_c2c_client::c2c_remove_from_community(user_id.into(), &c2c_remove_from_community_args).await {
            Ok(c2c_remove_from_community::Response::Success) => {
                // Push a MembersRemoved event
                mutate_state(|state| commit(block, user_id, prepare_result.removed_by, state));
                return Success;
            }
            Ok(c2c_remove_from_community::Response::CannotRemoveUser) => CannotRemoveUser,
            Err(error) => InternalError(format!("{error:?}")),
        };

    // Put the member back
    mutate_state(|state| {
        rollback(
            block,
            prepare_result.principal_to_remove,
            prepare_result.member_to_remove,
            prepare_result.groups_removed_from,
            state,
        )
    });

    response
}

struct PrepareResult {
    removed_by: UserId,
    community_name: String,
    public: bool,
    member_to_remove: CommunityMemberInternal,
    principal_to_remove: Principal,
    groups_removed_from: HashMap<CommunityGroupId, GroupMemberInternal>,
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

            // Remove the user from the community
            let removed_by = member.user_id;
            let member_to_remove = state
                .data
                .members
                .remove_by_principal(&principal_to_remove)
                .expect("user must be a member");

            // Remove the user from each group they are a member of
            let groups_removed_from = state.data.groups.remove_member(user_id);

            if block {
                // Also block the user
                state.data.members.block(user_id);
            }

            Ok(PrepareResult {
                removed_by,
                community_name: state.data.name.clone(),
                public: state.data.is_public,
                member_to_remove,
                principal_to_remove,
                groups_removed_from,
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

fn rollback(
    block: bool,
    principal: Principal,
    member: CommunityMemberInternal,
    groups_removed_from: HashMap<CommunityGroupId, GroupMemberInternal>,
    state: &mut RuntimeState,
) {
    if block {
        state.data.members.unblock(&member.user_id);
    }

    state.data.members.try_undo_remove(principal, member);

    for (group_id, member) in groups_removed_from {
        if let Some(group) = state.data.groups.get_mut(&group_id) {
            group.members.try_undo_remove(member);
        }
    }
}
