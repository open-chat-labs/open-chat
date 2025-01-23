use crate::{guards::caller_is_openchat_user, mutate_state, read_state, UserIndexEvent};
use canister_api_macros::update;
use canister_client::generate_c2c_call;
use canister_tracing_macros::trace;
use local_user_index_canister::uninstall_bot::{Response::*, *};
use types::c2c_uninstall_bot;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn uninstall_bot(args: Args) -> Response {
    let user_id = read_state(|state| {
        let caller = state.env.caller();
        let user = state.data.global_users.get(&caller).unwrap();
        user.user_id
    });

    match c2c_uninstall_bot(
        args.location.canister_id(),
        &c2c_uninstall_bot::Args {
            bot_id: args.bot_id,
            caller: user_id,
        },
    )
    .await
    {
        Ok(c2c_uninstall_bot::Response::Success) => (),
        Ok(other) => return other.into(),
        Err((_, message)) => return InternalError(message),
    }

    mutate_state(|state| {
        state.push_event_to_user_index(UserIndexEvent::BotUninstalled(Box::new(
            user_index_canister::BotUninstalled {
                bot_id: args.bot_id,
                location: args.location,
                uninstalled_by: user_id,
            },
        )));
    });

    Success
}

generate_c2c_call!(c2c_uninstall_bot);
