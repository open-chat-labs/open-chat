use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::bot_installations::*;

#[query(candid = true, msgpack = true)]
fn bot_installations(args: Args) -> Response {
    match read_state(|state| bot_installations_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn bot_installations_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();

    let Some(bot) = state.data.users.get_bot(&caller.into()) else {
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

    Ok(SuccessResult { events })
}
