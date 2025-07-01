use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::active_proposal_tallies::*;
use community_canister::c2c_active_proposal_tallies::Args as C2CArgs;
use ic_principal::Principal;
use types::{ActiveTalliesSuccessResult, OCResult};

#[query(msgpack = true)]
fn active_proposal_tallies(args: Args) -> Response {
    match read_state(|state| active_proposal_tallies_impl(args, None, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_active_proposal_tallies(args: C2CArgs) -> Response {
    match read_state(|state| active_proposal_tallies_impl(args.args, Some(args.caller), state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn active_proposal_tallies_impl(
    args: Args,
    on_behalf_of: Option<Principal>,
    state: &RuntimeState,
) -> OCResult<ActiveTalliesSuccessResult> {
    let caller = on_behalf_of.unwrap_or_else(|| state.env.caller());
    state.data.verify_is_accessible(caller, args.invite_code)?;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;

    Ok(ActiveTalliesSuccessResult {
        tallies: channel.chat.events.active_proposal_tallies(),
    })
}
