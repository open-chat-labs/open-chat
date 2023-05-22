use crate::{model::events::CommunityEvent, mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::remove_member::{Response::*, *};
use ic_cdk_macros::update;
use local_user_index_canister_c2c_client::{lookup_user, LookupUserError};
use types::{CanisterId, MembersRemoved, UserId, UsersBlocked};
use user_canister::c2c_remove_from_community;

#[update]
#[trace]
async fn block_user(args: community_canister::block_user::Args) -> community_canister::block_user::Response {
    if !read_state(|state| state.data.is_public) {
        return community_canister::block_user::Response::CommunityNotPublic;
    }

    remove_member_impl(args.user_id, true).await.into()
}

#[update]
#[trace]
async fn remove_member(args: Args) -> Response {
    remove_member_impl(args.user_id, false).await
}

async fn remove_member_impl(user_id: UserId, block: bool) -> Response {
    // Check the caller can remove the user
    let prepare_result = match read_state(|state| prepare(user_id, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    // If the user is an owner of the community then call the local_user_index
    // to check whether they are a "platform moderator" in which case this removal
    // is not authorized
    if prepare_result.is_user_an_owner {
        match lookup_user(user_id.into(), prepare_result.local_user_index_canister_id).await {
            Ok(user) if user.is_platform_moderator => (),
            Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
            Err(LookupUserError::InternalError(error)) => return InternalError(error),
        }
    }

    // Remove the user from the community
    mutate_state(|state| commit(user_id, block, prepare_result.removed_by, state));

    Success
}

struct PrepareResult {
    removed_by: UserId,
    local_user_index_canister_id: CanisterId,
    is_user_an_owner: bool,
}

fn prepare(user_id: UserId, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.user_id == user_id {
            Err(CannotRemoveSelf)
        } else {
            // Check if the caller is authorized to remove the user
            let is_user_an_owner = match state.data.members.get(user_id.into()) {
                None => return Err(UserNotInCommunity),
                Some(member_to_remove) => {
                    if member
                        .role
                        .can_remove_members_with_role(member_to_remove.role, &state.data.permissions)
                    {
                        member.role.is_owner()
                    } else {
                        return Err(NotAuthorized);
                    }
                }
            };

            Ok(PrepareResult {
                removed_by: member.user_id,
                local_user_index_canister_id: state.data.local_user_index_canister_id,
                is_user_an_owner,
            })
        }
    } else {
        Err(CallerNotInCommunity)
    }
}

fn commit(user_id: UserId, block: bool, removed_by: UserId, state: &mut RuntimeState) {
    // Remove the user from the community
    state.data.members.remove(&user_id).expect("user must be a member");

    // Remove the user from each group they are a member of
    state.data.groups.remove_member(user_id);

    if block {
        // Also block the user
        state.data.members.block(user_id);
    }

    // Push relevant event
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
    state.data.events.push_event(event, state.env.now());

    // Fire-and-forget call to notify the user canister
    // TODO: This should retry on failure
    ic_cdk::spawn(remove_membership_from_user_canister(
        user_id,
        removed_by,
        block,
        state.data.name.clone(),
        state.data.is_public,
    ));
}

async fn remove_membership_from_user_canister(
    user_id: UserId,
    removed_by: UserId,
    blocked: bool,
    community_name: String,
    public: bool,
) {
    let _ = user_canister_c2c_client::c2c_remove_from_community(
        user_id.into(),
        &c2c_remove_from_community::Args {
            removed_by,
            blocked,
            community_name,
            public,
        },
    )
    .await;
}
