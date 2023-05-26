use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use group_index_canister::{freeze_community, unfreeze_community};
use ic_cdk_macros::update;
use types::{CanisterId, CommunityId, FrozenGroupInfo};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};

#[update]
#[trace]
async fn freeze_community(args: freeze_community::Args) -> freeze_community::Response {
    use group_index_canister::freeze_community::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.community_id, state)) {
        Ok(ok) if !ok.is_frozen => ok,
        Ok(_) => return CommunityAlreadyFrozen,
        Err(_) => return CommunityNotFound,
    };

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => user.user_id,
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = community_canister::c2c_freeze_community::Args {
        caller: user_id,
        reason: args.reason.clone(),
        return_members: args.suspend_members.is_some(),
    };
    match community_canister_c2c_client::c2c_freeze_community(args.community_id.into(), &c2c_args).await {
        Ok(community_canister::c2c_freeze_community::Response::Success(event)) => {
            mutate_state(|state| {
                let info = FrozenGroupInfo {
                    timestamp: state.env.now(),
                    frozen_by: user_id,
                    reason: args.reason,
                };
                commit(&args.community_id, Some(info), state);
            });
            Success(event)
        }
        Ok(community_canister::c2c_freeze_community::Response::SuccessWithMembers(event, members)) => {
            let user_index_canister_id = mutate_state(|state| {
                let info = FrozenGroupInfo {
                    timestamp: state.env.now(),
                    frozen_by: user_id,
                    reason: args.reason,
                };
                commit(&args.community_id, Some(info), state);
                state.data.user_index_canister_id
            });
            if let Some(suspension_details) = args.suspend_members {
                let suspend_users_args = user_index_canister::c2c_suspend_users::Args {
                    user_ids: members,
                    duration: suspension_details.duration,
                    reason: suspension_details.reason,
                    suspended_by: user_id,
                };
                user_index_canister_c2c_client::c2c_suspend_users(user_index_canister_id, &suspend_users_args)
                    .await
                    .unwrap();
            }
            Success(event)
        }
        Ok(community_canister::c2c_freeze_community::Response::CommunityAlreadyFrozen) => CommunityAlreadyFrozen,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

#[update]
#[trace]
async fn unfreeze_community(args: unfreeze_community::Args) -> unfreeze_community::Response {
    use group_index_canister::unfreeze_community::Response::*;

    let PrepareResult {
        caller,
        user_index_canister_id,
        ..
    } = match read_state(|state| prepare(&args.community_id, state)) {
        Ok(ok) if ok.is_frozen => ok,
        Ok(_) => return CommunityNotFrozen,
        Err(_) => return CommunityNotFound,
    };

    let user_id = match lookup_user(caller, user_index_canister_id).await {
        Ok(user) if user.is_platform_moderator => user.user_id,
        Ok(_) | Err(LookupUserError::UserNotFound) => return NotAuthorized,
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    let c2c_args = community_canister::c2c_unfreeze_community::Args { caller: user_id };
    match community_canister_c2c_client::c2c_unfreeze_community(args.community_id.into(), &c2c_args).await {
        Ok(community_canister::c2c_unfreeze_community::Response::Success(event)) => {
            mutate_state(|state| commit(&args.community_id, None, state));
            Success(event)
        }
        Ok(community_canister::c2c_unfreeze_community::Response::CommunityNotFrozen) => CommunityNotFrozen,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    is_frozen: bool,
}

fn prepare(community_id: &CommunityId, state: &RuntimeState) -> Result<PrepareResult, ()> {
    if let Some(frozen_info) = state.data.community_frozen_info(community_id) {
        Ok(PrepareResult {
            caller: state.env.caller(),
            is_frozen: frozen_info.is_some(),
            user_index_canister_id: state.data.user_index_canister_id,
        })
    } else {
        // ChatNotFound
        Err(())
    }
}

fn commit(community_id: &CommunityId, info: Option<FrozenGroupInfo>, state: &mut RuntimeState) {
    if let Some(chat) = state.data.public_communities.get_mut(community_id) {
        chat.set_frozen(info);
    } else if let Some(chat) = state.data.private_communities.get_mut(community_id) {
        chat.set_frozen(info);
    } else {
        unreachable!();
    }
}
