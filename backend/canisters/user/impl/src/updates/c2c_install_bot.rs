use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use rand::RngExt;
use types::{OCResult, c2c_install_bot::*};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    execute_update(|state| c2c_install_bot_impl(args, state)).into()
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();
    let anonymized_id: u128 = state.env.rng().random();
    user_core::updates::c2c_install_bot(&mut state.data.user, args, my_user_id, anonymized_id, now)
}
