use crate::guards::caller_is_local_user_canister;
use crate::{mutate_state, FailedMessageUsers, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_failed_messages::{Response::*, *};
use types::UserId;

#[update_msgpack(guard = "caller_is_local_user_canister")]
#[trace]
fn c2c_notify_failed_messages(args: Args) -> Response {
    mutate_state(|state| c2c_notify_failed_messages_impl(args, state))
}

fn c2c_notify_failed_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let user_id: UserId = runtime_state.env.caller().into();

    for recipient in args.recipients {
        runtime_state.data.failed_message_users.push(FailedMessageUsers {
            sender: user_id,
            recipient,
        });
    }

    Success
}
