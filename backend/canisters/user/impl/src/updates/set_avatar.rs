use crate::guards::caller_is_owner;
use crate::updates::set_avatar::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, FieldTooLongResult, Timestamped, MAX_AVATAR_SIZE};
use user_canister::set_avatar::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_avatar(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_avatar_impl(args, state))
}

fn set_avatar_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        return UserSuspended;
    }

    let avatar_size = args.avatar.as_ref().map_or(0, |a| a.data.len() as u32);
    if avatar_size > MAX_AVATAR_SIZE {
        return AvatarTooBig(FieldTooLongResult {
            length_provided: avatar_size,
            max_length: MAX_AVATAR_SIZE,
        });
    }

    let id = args.avatar.as_ref().map(|a| a.id);
    let now = runtime_state.env.now();

    runtime_state.data.avatar = Timestamped::new(args.avatar, now);

    ic_cdk::spawn(update_index_canister(runtime_state.data.user_index_canister_id, id));

    Success
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: Option<u128>) {
    let args = user_index_canister::c2c_set_avatar::Args { avatar_id };
    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
