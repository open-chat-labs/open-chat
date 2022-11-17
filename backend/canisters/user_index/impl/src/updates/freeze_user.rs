use crate::guards::caller_is_controller;
use crate::model::set_user_frozen_queue::{SetUserFrozen, SetUserFrozenInGroup};
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, Milliseconds, UserId};
use user_index_canister::freeze_user::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
async fn freeze_user(args: Args) -> Response {
    let c2c_args = user_canister::c2c_set_user_frozen::Args { frozen: true };
    match user_canister_c2c_client::c2c_set_user_frozen(args.user_id.into(), &c2c_args).await {
        Ok(user_canister::c2c_set_user_frozen::Response::Success(result)) => {
            mutate_state(|state| commit(args.user_id, args.duration, result.groups, state));
            Success
        }
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(user_id: UserId, duration: Option<Milliseconds>, groups: Vec<ChatId>, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    runtime_state.data.set_user_frozen_queue.enqueue(
        groups
            .into_iter()
            .map(|g| {
                SetUserFrozen::Group(SetUserFrozenInGroup {
                    user_id,
                    group: g,
                    frozen: true,
                    attempt: 0,
                })
            })
            .collect(),
    );
    let frozen_until = duration.map(|d| now + d);

    runtime_state.data.users.freeze_user(&user_id, frozen_until);

    // If the user is only frozen for a specified duration, schedule them to be unfrozen
    if let Some(ts) = frozen_until {
        runtime_state
            .data
            .set_user_frozen_queue
            .schedule(vec![SetUserFrozen::Unfreeze(user_id)], ts);
    }
}
