use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group;
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{CanisterId, ChatId, OCResult};
use user_canister::create_group::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn create_group(args: Args) -> Response {
    execute_update_async(|| create_group_impl(args)).await
}

async fn create_group_impl(args: Args) -> Response {
    let (group_index_canister_id, create_group_args) = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(response) => match response {
            c2c_create_group::Response::Success(r) => {
                mutate_state(|state| commit(r.chat_id, r.local_user_index_canister_id, state));
                Success(SuccessResult { chat_id: r.chat_id })
            }
            c2c_create_group::Response::NameTaken => Error(OCErrorCode::NameTaken.into()),
            c2c_create_group::Response::Error(error) => Error(error),
            c2c_create_group::Response::CyclesBalanceTooLow
            | c2c_create_group::Response::UserNotFound
            | c2c_create_group::Response::InternalError => Error(OCErrorCode::Unknown.into()),
        },
        Err(error) => {
            error!(?error, "Error calling create group");
            Error(error.into())
        }
    }
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<(CanisterId, c2c_create_group::Args)> {
    let create_group_args =
        user_core::updates::create_group::prepare(&state.data.user, args, None, state.data.test_mode, state.env.now())?;
    Ok((state.data.group_index_canister_id, create_group_args))
}

fn commit(chat_id: ChatId, local_user_index_canister_id: CanisterId, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.user.group_chats.create(chat_id, local_user_index_canister_id, now);
}
