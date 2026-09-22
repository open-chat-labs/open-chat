use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, CommunityId, OCResult};
use user_canister::create_community::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn create_community(args: Args) -> Response {
    execute_update_async(|| create_community_impl(args)).await
}

async fn create_community_impl(args: Args) -> Response {
    let (group_index_canister_id, create_community_args) = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_create_community(group_index_canister_id, &create_community_args).await {
        Ok(response) => match response {
            c2c_create_community::Response::Success(r) => {
                mutate_state(|state| commit(r.community_id, r.local_user_index_canister_id, state));
                Success(SuccessResult {
                    community_id: r.community_id,
                    channels: r.channels,
                })
            }
            c2c_create_community::Response::NameTaken => Error(OCErrorCode::NameTaken.into()),
            c2c_create_community::Response::UserNotFound => Error(OCErrorCode::InitiatorNotFound.into()),
            c2c_create_community::Response::InternalError(error) => Error(OCErrorCode::Unknown.with_message(error)),
            c2c_create_community::Response::Error(error) => Error(error),
        },
        Err(error) => Error(error.into()),
    }
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<(CanisterId, c2c_create_community::Args)> {
    let create_community_args =
        user_core::updates::create_community::prepare(&state.data.user, args, None, state.data.test_mode, state.env.now())?;
    Ok((state.data.group_index_canister_id, create_community_args))
}

fn commit(community_id: CommunityId, local_user_index_canister_id: CanisterId, state: &mut RuntimeState) {
    let now = state.env.now();
    state
        .data
        .user
        .communities
        .create(community_id, local_user_index_canister_id, now);
}
