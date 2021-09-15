use crate::model::events::DirectChatEventInternal;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use log::error;
use search::*;
use types::UserId;
use types::{ChatId, CombinedMessageMatch, GroupMessageMatch};
use user_canister::search_all_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query]
async fn search_all_messages(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let mut matches = search_all_group_chats(
        prepare_result.group_chats,
        args.search_term.to_owned(),
        args.max_results,
        prepare_result.me,
    )
    .await;

    let mut direct_chat_matches = RUNTIME_STATE.with(|state| search_all_direct_chats(&args, state.borrow().as_ref().unwrap()));

    matches.append(&mut direct_chat_matches);
    matches.sort_unstable_by(|m1, m2| m2.score.cmp(&m1.score));
    matches = matches[..args.max_results as usize].to_vec();

    Success(SuccessResult { matches })
}

struct PrepareResult {
    group_chats: Vec<ChatId>,
    me: UserId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    runtime_state.trap_if_caller_not_owner();

    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return Err(TermTooShort(MIN_TERM_LENGTH));
    }

    if term_length > MAX_TERM_LENGTH {
        return Err(TermTooLong(MAX_TERM_LENGTH));
    }

    let me: UserId = runtime_state.env.caller().into();

    let group_chats = runtime_state.data.group_chats.iter().map(|gc| gc.chat_id).collect();

    Ok(PrepareResult { group_chats, me })
}

fn search_all_direct_chats(args: &Args, runtime_state: &RuntimeState) -> Vec<CombinedMessageMatch> {
    let now = runtime_state.env.now();
    let me: UserId = runtime_state.env.caller().into();
    let query = Query::parse(&args.search_term);

    let mut matches: Vec<_> = runtime_state
        .data
        .direct_chats
        .get_all(Some(0))
        .flat_map(|dc| dc.events.get_all().map(move |e| (dc.them, e)))
        .filter_map(|(user_id, e)| match &e.event {
            DirectChatEventInternal::Message(m) => {
                let mut document: Document = (&m.content).into();
                document.set_age(now - e.timestamp);
                match document.calculate_score(&query) {
                    0 => None,
                    n => Some((user_id, e.index, n, m)),
                }
            }
            _ => None,
        })
        .collect();

    matches.sort_unstable_by(|m1, m2| m2.0.cmp(&m1.0));

    matches
        .iter()
        .take(args.max_results as usize)
        .map(|m| CombinedMessageMatch {
            chat_id: m.0.into(),
            sender: if m.3.sent_by_me { me } else { m.0 },
            event_index: m.1,
            score: m.2,
            content: m.3.content.clone(),
        })
        .collect()
}

async fn search_all_group_chats(
    chat_ids: Vec<ChatId>,
    search_term: String,
    max_results: u8,
    user_id: UserId,
) -> Vec<CombinedMessageMatch> {
    let args = group_canister::c2c_search_messages::Args {
        user_id,
        search_term,
        max_results,
    };

    let count = chat_ids.len();
    let futures: Vec<_> = chat_ids
        .into_iter()
        .map(|g| group_canister_c2c_client::c2c_search_messages(g.into(), &args))
        .collect();

    let responses = futures::future::join_all(futures).await;

    let mut successes = Vec::new();
    let mut failures = Vec::new();

    for response in responses.into_iter() {
        match response {
            Ok(result) => {
                if let group_canister::c2c_search_messages::Response::Success(r) = result {
                    successes.push(r);
                };
            }
            Err(error) => failures.push(error),
        }
    }

    if !failures.is_empty() {
        error!(
            "Error searching group messages. {} chat(s) failed out of {}. First error: {:?}",
            failures.len(),
            count,
            failures.first().unwrap()
        );
    }

    let mut matches: Vec<(ChatId, GroupMessageMatch)> = successes
        .into_iter()
        .flat_map(|r| {
            let chat_id = r.chat_id;
            r.matches.into_iter().map(move |m| (chat_id, m))
        })
        .collect();

    matches.sort_unstable_by(|m1, m2| m2.1.score.cmp(&m1.1.score));

    matches
        .iter()
        .take(max_results as usize)
        .map(|m| CombinedMessageMatch {
            chat_id: m.0,
            sender: m.1.sender,
            event_index: m.1.event_index,
            score: m.1.score,
            content: m.1.content.clone(),
        })
        .collect()
}
