use crate::guards::caller_is_governance_principal;
use crate::{jobs, mutate_state, read_state, RuntimeState};
use canister_api_macros::{proposal, update};
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use local_user_index_canister::{BotRemoved, BotUninstall, UserIndexEvent};
use types::UserId;
use user_index_canister::remove_bot::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn remove_bot(args: Args) -> Response {
    match read_state(|state| {
        let Some(bot) = state.data.users.get_bot(&args.bot_id) else {
            return Err(BotNotFound);
        };

        let Some(caller) = state.data.users.get_by_principal(&state.env.caller()) else {
            return Err(NotAuthorised);
        };

        if caller.user_id != bot.owner {
            return Err(NotAuthorised);
        }

        Ok(bot.owner)
    }) {
        Ok(owner) => {
            mutate_state(|state| remove_bot_impl(args, Some(owner), state));
            Success
        }
        Err(response) => response,
    }
}

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn remove_bot(args: Args) -> Response {
    mutate_state(|state| remove_bot_impl(args, None, state));
    Success
}

fn remove_bot_impl(args: Args, deleted_by: Option<UserId>, state: &mut RuntimeState) -> Response {
    let Some(bot) = state.data.users.remove_bot(args.bot_id, state.env.now()) else {
        return BotNotFound;
    };

    state.delete_user(args.bot_id, deleted_by.is_some());

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::BotRemoved(BotRemoved {
            user_id: args.bot_id,
            deleted_by: deleted_by.unwrap_or(OPENCHAT_BOT_USER_ID),
        }),
        None,
    );

    for (location, details) in bot.installations.iter() {
        state.data.user_index_event_sync_queue.push(
            details.local_user_index,
            UserIndexEvent::BotUninstall(BotUninstall {
                location: *location,
                bot_id: args.bot_id,
            }),
        );
    }

    jobs::sync_events_to_local_user_index_canisters::try_run_now(state);
    Success
}
