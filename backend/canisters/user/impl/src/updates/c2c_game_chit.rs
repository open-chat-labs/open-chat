use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_game_chit::{Response::*, *};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_game_chit(args: Args) -> Response {
    execute_update(|state| c2c_game_chit_impl(args, state))
}

fn c2c_game_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    match user_core::updates::c2c_game_chit(&mut state.data.user, args, now) {
        Ok(result) => {
            state.notify_user_index_of_chit(now);
            Success(result)
        }
        Err(error) => Error(error),
    }
}
