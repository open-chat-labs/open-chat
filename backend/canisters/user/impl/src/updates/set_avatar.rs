use crate::guards::caller_is_owner;
use crate::updates::set_avatar::Response::*;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, Timestamped};
use user_canister::set_avatar::*;
use utils::document_validation::validate_avatar;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_avatar(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_avatar_impl(args, state))
}

fn set_avatar_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return AvatarTooBig(error);
    }

    let id = args.avatar.as_ref().map(|a| a.id);
    let now = state.env.now();

    state.data.avatar = Timestamped::new(args.avatar, now);

    ic_cdk::spawn(update_index_canister(state.data.user_index_canister_id, id));

    Success
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: Option<u128>) {
    let args = user_index_canister::c2c_set_avatar::Args { avatar_id };
    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
