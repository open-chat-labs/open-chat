use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_pay_for_premium_item::{Response::*, *};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_pay_for_premium_item(args: Args) -> Response {
    mutate_state(|state| c2c_pay_for_premium_item_impl(args, state))
}

fn c2c_pay_for_premium_item_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return Error(OCErrorCode::TargetUserNotFound.into());
    };
    let now = state.env.now();
    let result = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::c2c_pay_for_premium_item(user, args, now)
        })
        .unwrap_or_else(|| Err(OCErrorCode::TargetUserNotFound.into()));
    match result {
        Ok(result) => {
            state.notify_user_index_of_chit(user_index, now);
            Success(result)
        }
        Err(error) => Error(error),
    }
}
