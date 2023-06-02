use crate::guards::caller_is_admin;
use crate::updates::set_avatar::Response::*;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use satoshi_dice_canister::set_avatar::*;
use types::{CanisterId, Timestamped};
use utils::avatar_validation::validate_avatar;

#[update(guard = "caller_is_admin")]
#[trace]
fn set_avatar(args: Args) -> Response {
    mutate_state(|state| set_avatar_impl(args, state))
}

fn set_avatar_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return AvatarTooBig(error);
    }

    let id = args.avatar.as_ref().map(|a| a.id);
    let now = state.env.now();

    state.data.avatar = Timestamped::new(args.avatar, now);

    let user_index_canister_id = state.data.user_index_canister_id;
    ic_cdk::spawn(update_index_canister(user_index_canister_id, id));

    Success
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: Option<u128>) {
    let args = user_index_canister::c2c_set_avatar::Args { avatar_id };
    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
