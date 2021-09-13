use crate::model::events::DirectChatEventInternal;
use crate::{DirectChats, GroupChats};
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use search::*;
use types::UserId;
use types::{CombinedMessageMatch, TimestampMillis};
use user_canister::search_all_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query]
fn search_all_messages(args: Args) -> Response {
    RUNTIME_STATE.with(|state| search_all_messages_impl(args, state.borrow().as_ref().unwrap()))
}

fn search_all_messages_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let now = runtime_state.env.now();
    let me: UserId = runtime_state.env.caller().into();
    let query = Query::parse(&args.search_term);

    let direct_chat_matches = search_all_direct_chats(&runtime_state.data.direct_chats, &query, args.max_results, now, me);
    let mut group_chat_matches = search_all_group_chats(&runtime_state.data.group_chats, &query, args.max_results, now);

    let mut matches = direct_chat_matches;
    matches.append(&mut group_chat_matches);
    matches.sort_unstable_by(|m1, m2| m2.score.cmp(&m1.score));
    matches = matches.into_iter().take(args.max_results as usize).collect();

    Success(SuccessResult { matches })
}

fn search_all_direct_chats(
    direct_chats: &DirectChats,
    query: &Query,
    max_results: u8,
    now: TimestampMillis,
    me: UserId,
) -> Vec<CombinedMessageMatch> {
    let mut matches: Vec<_> = direct_chats
        .get_all(Some(0))
        .flat_map(|dc| dc.events.get_all().map(move |e| (dc.chat_id, dc.them, e)))
        .filter_map(|(chat_id, user_id, e)| match &e.event {
            DirectChatEventInternal::Message(m) => {
                let mut document: Document = (&m.content).into();
                document.set_age(now - e.timestamp);
                match document.calculate_score(query) {
                    0 => None,
                    n => Some((chat_id, user_id, e.index, n, m)),
                }
            }
            _ => None,
        })
        .collect();

    matches.sort_unstable_by(|m1, m2| m2.0.cmp(&m1.0));

    matches
        .iter()
        .take(max_results as usize)
        .map(|m| CombinedMessageMatch {
            chat_id: m.0,
            sender: if m.4.sent_by_me { me } else { m.1 },
            event_index: m.2,
            score: m.3,
            content: m.4.content.clone(),
        })
        .collect()
}

fn search_all_group_chats(
    _direct_chats: &GroupChats,
    _query: &Query,
    _max_results: u8,
    _now: TimestampMillis,
) -> Vec<CombinedMessageMatch> {
    vec![]
}
