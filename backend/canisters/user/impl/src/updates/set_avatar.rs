use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, CanisterId, OCResult, Timestamped};
use user_canister::set_avatar::*;
use utils::document::validate_avatar;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_avatar(args: Args) -> Response {
    execute_update(|state| set_avatar_impl(args, state)).into()
}

fn set_avatar_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return Err(OCErrorCode::AvatarTooBig.with_json(&error));
    }

    let id = args.avatar.as_ref().map(|a| a.id);
    let now = state.env.now();

    state.data.avatar = Timestamped::new(args.avatar, now);
    state.award_achievement_and_notify(Achievement::SetAvatar, now);

    ic_cdk::futures::spawn(update_index_canister(state.data.user_index_canister_id, id));

    Ok(())
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: Option<u128>) {
    let args = user_index_canister::c2c_set_avatar::Args { avatar_id };
    let _ = user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await;
}
