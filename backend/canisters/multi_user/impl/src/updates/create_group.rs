use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_create_group;
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{CanisterId, ChatId, OCResult};
use user_canister::create_group::{Response::*, *};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn create_group(args: Args) -> Response {
    let PrepareResult {
        my_index,
        group_index_canister_id,
        create_group_args,
    } = match read_state(|state| prepare(args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match group_index_canister_c2c_client::c2c_create_group(group_index_canister_id, &create_group_args).await {
        Ok(response) => match response {
            c2c_create_group::Response::Success(r) => {
                mutate_state(|state| commit(my_index, r.chat_id, r.local_user_index_canister_id, state));
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

struct PrepareResult {
    my_index: u16,
    group_index_canister_id: CanisterId,
    create_group_args: c2c_create_group::Args,
}

fn prepare(args: Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.with_caller_user(|my_index, user| {
        let create_group_args = user_core::updates::create_group::prepare(
            user,
            args,
            Some(state.user_id(my_index)),
            state.data.test_mode,
            state.env.now(),
        )?;
        Ok(PrepareResult {
            my_index,
            group_index_canister_id: state.data.group_index_canister_id,
            create_group_args,
        })
    })
}

fn commit(my_index: u16, chat_id: ChatId, local_user_index_canister_id: CanisterId, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.users.with_user_mut(my_index, |user| {
        user.group_chats.create(chat_id, local_user_index_canister_id, now)
    });
}
