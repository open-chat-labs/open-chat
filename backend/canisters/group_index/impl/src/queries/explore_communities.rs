use crate::{model::moderation_tags::ModerationTags, read_state, RuntimeState};
use group_index_canister::explore_communities::{Response::*, *};
use ic_cdk_macros::query;

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query]
fn explore_communities(args: Args) -> Response {
    read_state(|state| explore_communities_impl(args, state))
}

fn explore_communities_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(term_length) = args.search_term.as_ref().map(|st| st.len() as u8) {
        if term_length < MIN_TERM_LENGTH {
            return TermTooShort(MIN_TERM_LENGTH);
        }

        if term_length > MAX_TERM_LENGTH {
            return TermTooLong(MAX_TERM_LENGTH);
        }
    }

    let exclude_moderation_tags = match ModerationTags::from_bits(args.exclude_moderation_tags.unwrap_or_default()) {
        Some(tags) => tags,
        None => return InvalidTags,
    };

    let matches =
        state
            .data
            .public_communities
            .search(args.search_term, exclude_moderation_tags, args.page_index, args.page_size);

    Success(SuccessResult { matches })
}
