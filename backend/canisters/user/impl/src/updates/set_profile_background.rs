use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, Timestamped};
use user_canister::set_profile_background::*;
use utils::document::validate_profile_background;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    execute_update(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    if let Err(error) = validate_profile_background(args.profile_background.as_ref()) {
        return Err(OCErrorCode::ProfileBackgroundTooBig.with_json(&error));
    }

    let id = args.profile_background.as_ref().map(|a| a.id);
    let now = state.env.now();

    state.data.profile_background = Timestamped::new(args.profile_background, now);

    ic_cdk::futures::spawn(update_index_canister(state.data.user_index_canister_id, id));

    Ok(())
}

async fn update_index_canister(user_index_canister_id: CanisterId, profile_background_id: Option<u128>) {
    let args = user_index_canister::c2c_set_profile_background::Args { profile_background_id };
    let _ = user_index_canister_c2c_client::c2c_set_profile_background(user_index_canister_id, &args).await;
}
