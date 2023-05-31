use crate::{read_state, RuntimeState};
use community_canister::search_channel::{Response::*, *};
use group_chat_core::SearchResults;
use ic_cdk_macros::query;

#[query]
fn search_channel(args: Args) -> Response {
    read_state(|state| search_channel_impl(args, state))
}

fn search_channel_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if let Some(channel) = state.data.channels.get(&args.channel_id) {
            match channel.chat.search(
                member.user_id,
                args.search_term,
                args.users,
                args.max_results,
                state.env.now(),
            ) {
                SearchResults::Success(matches) => Success(SuccessResult { matches }),
                SearchResults::InvalidTerm => InvalidTerm,
                SearchResults::TermTooLong(v) => TermTooLong(v),
                SearchResults::TermTooShort(v) => TermTooShort(v),
                SearchResults::TooManyUsers(v) => TooManyUsers(v),
                SearchResults::UserNotInGroup => UserNotInChannel,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
