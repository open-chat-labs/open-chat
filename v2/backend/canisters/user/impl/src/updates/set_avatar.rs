use crate::guards::caller_is_owner;
use crate::updates::set_avatar::Response::*;
use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, FieldTooLongResult, MAX_AVATAR_SIZE};
use user_canister::set_avatar::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_avatar(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| set_avatar_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn set_avatar_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let avatar = args.avatar;

    if avatar.data.len() > MAX_AVATAR_SIZE as usize {
        return AvatarTooBig(FieldTooLongResult {
            length_provided: avatar.data.len() as u32,
            max_length: MAX_AVATAR_SIZE as u32,
        });
    }

    let id = avatar.id;

    runtime_state.data.avatar = Some(avatar);

    let user_index_canister_id = runtime_state.data.user_index_canister_id;

    ic_cdk::block_on(update_index_canister(user_index_canister_id, id));

    Success(id)
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: u128) {
    let args = user_index_canister::c2c_set_avatar::Args { avatar_id };
    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
