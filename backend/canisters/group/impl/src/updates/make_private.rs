use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::make_private::{Response::*, *};
use group_index_canister::c2c_make_private;
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, ChatId, GroupVisibilityChanged, UserId};

#[update]
#[trace]
async fn make_private(args: Args) -> Response {
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
                mutate_state(|state| commit(args, user_id, state));
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

    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.suspended.value {
            Err(UserSuspended)
        } else if !participant.role.can_change_group_visibility() {
            Err(NotAuthorized)
        } else if !runtime_state.data.is_public {
            Err(AlreadyPrivate)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                chat_id: runtime_state.env.canister_id().into(),
                user_id: participant.user_id,
            })
        }
    } else {
        Err(NotAuthorized)
    }
}

fn commit(args: Args, user_id: UserId, runtime_state: &mut RuntimeState) {
    runtime_state.data.is_public = false;

    let now = runtime_state.env.now();
    let event = GroupVisibilityChanged {
        now_public: false,
        changed_by: user_id,
    };

    runtime_state.data.events.push_main_event(
        ChatEventInternal::GroupVisibilityChanged(Box::new(event)),
        args.correlation_id,
        now,
    );

    handle_activity_notification(runtime_state);
}
