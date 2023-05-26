use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::make_private::{Response::*, *};
use group_chat_core::MakePrivateResult;
use group_index_canister::c2c_make_private;
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, ChatId, UserId};

#[update]
#[trace]
async fn make_private(_args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        group_index_canister_id,
        chat_id,
        user_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_make_private_args = c2c_make_private::Args {};

    match group_index_canister_c2c_client::c2c_make_private(group_index_canister_id, &c2c_make_private_args).await {
        Ok(response) => match response {
            c2c_make_private::Response::ChatNotFound => {
                error!(%chat_id, "Group not found in index");
                InternalError
            }
            c2c_make_private::Response::Success => {
                mutate_state(|state| commit(user_id, state));
                Success
            }
        },
        Err(_) => InternalError,
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    chat_id: ChatId,
    user_id: UserId,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    if runtime_state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    if let Some(user_id) = runtime_state.data.lookup_user_id(&runtime_state.env.caller()) {
        match runtime_state.data.chat.can_make_private(user_id) {
            MakePrivateResult::Success => Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                chat_id: runtime_state.env.canister_id().into(),
                user_id,
            }),
            MakePrivateResult::UserSuspended => Err(UserSuspended),
            MakePrivateResult::UserNotInGroup => Err(NotAuthorized),
            MakePrivateResult::NotAuthorized => Err(NotAuthorized),
            MakePrivateResult::AlreadyPrivate => Err(AlreadyPrivate),
        }
    } else {
        Err(NotAuthorized)
    }
}

fn commit(user_id: UserId, runtime_state: &mut RuntimeState) {
    runtime_state.data.chat.do_make_private(user_id, runtime_state.env.now());

    handle_activity_notification(runtime_state);
}
