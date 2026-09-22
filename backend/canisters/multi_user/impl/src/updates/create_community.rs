use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_community;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, CommunityId, OCResult};
use user_canister::create_community::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn create_community(args: Args) -> Response {
    let PrepareResult {
        my_index,
        group_index_canister_id,
        create_community_args,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_create_community(group_index_canister_id, &create_community_args).await {
        Ok(response) => match response {
            c2c_create_community::Response::Success(r) => {
                mutate_state(|state| commit(my_index, r.community_id, r.local_user_index_canister_id, state));
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

struct PrepareResult {
    my_index: u16,
    group_index_canister_id: CanisterId,
    create_community_args: c2c_create_community::Args,
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.with_caller_user(|my_index, user| {
        let create_community_args = user_core::updates::create_community::prepare(
            user,
            args,
            Some(state.user_id(my_index)),
            state.data.test_mode,
            state.env.now(),
        )?;
        Ok(PrepareResult {
            my_index,
            group_index_canister_id: state.data.group_index_canister_id,
            create_community_args,
        })
    })
}

fn commit(my_index: u16, community_id: CommunityId, local_user_index_canister_id: CanisterId, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.users.with_user_mut(my_index, |user| {
        user.communities.create(community_id, local_user_index_canister_id, now)
    });
}
