use crate::RuntimeState;
use crate::read_state;
use canister_api_macros::query;
use community_canister::explore_channels::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::OCResult;

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query(msgpack = true)]
fn explore_channels(args: Args) -> Response {
    match read_state(|state| explore_channels_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn explore_channels_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    if let Some(term_length) = args.search_term.as_ref().map(|st| st.len() as u8) {
        if term_length < MIN_TERM_LENGTH {
            return Err(OCErrorCode::TermTooShort.with_message(MIN_TERM_LENGTH));
        }

        if term_length > MAX_TERM_LENGTH {
            return Err(OCErrorCode::TermTooLong.with_message(MAX_TERM_LENGTH));
        }
    }

    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, args.invite_code)?;

    let (user_id, is_caller_community_owner) = state
        .data
        .members
        .get(caller)
        .map_or((None, false), |m| (Some(m.user_id), m.role().is_owner()));

    let (matches, total) = state.data.channels.search(
        user_id,
        args.search_term,
        args.page_index,
        args.page_size,
        is_caller_community_owner,
    );

    Ok(SuccessResult {
        timestamp: state.env.now(),
        matches,
        total,
    })
}
