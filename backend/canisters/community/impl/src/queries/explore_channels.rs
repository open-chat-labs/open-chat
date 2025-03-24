use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::explore_channels::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query(candid = true, msgpack = true)]
fn explore_channels(args: Args) -> Response {
    read_state(|state| explore_channels_impl(args, state))
}

fn explore_channels_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(term_length) = args.search_term.as_ref().map(|st| st.len() as u8) {
        if term_length < MIN_TERM_LENGTH {
            return TermTooShort(MIN_TERM_LENGTH);
        }

        if term_length > MAX_TERM_LENGTH {
            return TermTooLong(MAX_TERM_LENGTH);
        }
    }

    let caller = state.env.caller();

    if !state.data.is_accessible(caller, args.invite_code) {
        return PrivateCommunity;
    }

    let is_caller_community_owner = state.data.members.get(caller).is_some_and(|m| m.role().is_owner());

    let (matches, total) =
        state
            .data
            .channels
            .search(args.search_term, args.page_index, args.page_size, is_caller_community_owner);

    Success(SuccessResult { matches, total })
}
