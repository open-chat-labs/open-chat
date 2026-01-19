use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::bot_installation_events::*;

#[query(candid = true, msgpack = true)]
fn bot_installation_events(args: Args) -> Response {
    match read_state(|state| bot_installation_events_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn bot_installation_events_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();

    let Some(bot_id) = state.data.users.get_user_id_by_principal(&caller) else {
        return Err(OCErrorCode::BotNotFound.into());
    };

    let Some(bot) = state.data.users.get_bot(&bot_id) else {
        return Err(OCErrorCode::BotNotFound.into());
    };

    let events = bot
        .installation_events
        .iter()
        .enumerate()
        .skip_while(|(i, _)| *i < args.from as usize)
        .take(args.size as usize)
        .map(|(_, e)| (*e).clone().into())
        .collect();

    Ok(SuccessResult { bot_id, events })
}
