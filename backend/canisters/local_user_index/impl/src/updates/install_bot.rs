use crate::{guards::caller_is_openchat_user, mutate_state, read_state, RuntimeState, UserIndexEvent};
use canister_api_macros::update;
use canister_client::generate_c2c_call;
use canister_tracing_macros::trace;
use local_user_index_canister::install_bot::{Response::*, *};
use types::{c2c_install_bot, BotRegistrationStatus, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn install_bot(args: Args) -> Response {
    let user_id = match read_state(|state| prepare(&args, state)) {
        Ok(user_id) => user_id,
        Err(response) => return response,
    };

    match c2c_install_bot(
        args.location.canister_id(),
        &c2c_install_bot::Args {
            bot_id: args.bot_id,
            caller: user_id,
            granted_permissions: args.granted_permissions,
        },
    )
    .await
    {
        Ok(c2c_install_bot::Response::Success) => (),
        Ok(other) => return other.into(),
        Err((_, message)) => return InternalError(message),
    }

    mutate_state(|state| {
        state.push_event_to_user_index(UserIndexEvent::BotInstalled(Box::new(user_index_canister::BotInstalled {
            bot_id: args.bot_id,
            location: args.location,
            installed_by: user_id,
        })));
    });

    Success
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<UserId, Response> {
    let caller = state.env.caller();
    let user = state.data.global_users.get(&caller).unwrap();
    let bot = state.data.bots.get(&args.bot_id).ok_or(Response::NotFound)?;

    match bot.registration_status {
        BotRegistrationStatus::Public => (),
        BotRegistrationStatus::Private(location) => {
            let is_authorized = location.is_some_and(|loc| loc == args.location) || bot.owner_id == user.user_id;
            if !is_authorized {
                return Err(Response::NotAuthorized);
            }
        }
    }

    Ok(user.user_id)
}

generate_c2c_call!(c2c_install_bot);
