use crate::model::callbacks::Callback;
use crate::{mutate_state, RuntimeState};
use callback_canister::c2c_register_callback::{Response::*, *};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;

#[update_msgpack]
#[trace]
fn c2c_register_callback(args: Args) -> Response {
    mutate_state(|state| c2c_register_callback_impl(args, state))
}

fn c2c_register_callback_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let callback = Callback {
        canister_id: caller,
        method_name: args.method_name,
        payload: args.payload,
        is_retry: false,
    };
    runtime_state.data.callbacks.add(callback, args.timestamp);
    Success
}
