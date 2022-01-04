use crate::guards::caller_is_owner;
use crate::{read_state, RuntimeState};
use chat_events::ChatEventInternal;
use ic_cdk_macros::query;
use search::*;
use tracing::error;
use types::UserId;
use types::{ChatId, MessageMatch};
use user_canister::search_all_messages::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 3;
const MAX_TERM_LENGTH: u8 = 30;

#[query(guard = "caller_is_owner")]
async fn search_all_messages(args: Args) -> Response {
    let prepare_result = match read_state(|state| prepare(&args, state)) {
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

    let mut direct_chat_matches = read_state(|state| search_all_direct_chats(&args, state));

    matches.append(&mut direct_chat_matches);
    matches.sort_unstable_by(|m1, m2| m2.score.cmp(&m1.score));
    matches = matches.into_iter().take(args.max_results as usize).collect();

    Success(SuccessResult { matches })
}

struct PrepareResult {
    group_chats: Vec<ChatId>,
    me: UserId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
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

fn search_all_direct_chats(args: &Args, runtime_state: &RuntimeState) -> Vec<MessageMatch> {
    let now = runtime_state.env.now();
    let query = Query::parse(&args.search_term);

    let mut matches: Vec<_> = runtime_state
        .data
        .direct_chats
        .get_all(Some(0))
        .flat_map(|dc| dc.events.iter().map(move |e| (dc.them, e)))
        .filter_map(|(their_user_id, e)| match &e.event {
            ChatEventInternal::Message(m) => {
                let mut document: Document = (&m.content).into();
                document.set_age(now - e.timestamp);
                match document.calculate_score(&query) {
                    0 => None,
                    n => Some(MessageMatch {
                        chat_id: their_user_id.into(),
                        sender: m.sender,
                        message_index: m.message_index,
                        score: n,
                        content: m.content.clone(),
                    }),
                }
            }
            _ => None,
        })
        .collect();

    matches.sort_unstable_by(|m1, m2| m2.score.cmp(&m1.score));

    matches.into_iter().take(args.max_results as usize).collect()
}

async fn search_all_group_chats(
    chat_ids: Vec<ChatId>,
    search_term: String,
    max_results: u8,
    user_id: UserId,
) -> Vec<MessageMatch> {
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

    for response in responses {
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
            failed_chat_count = failures.len(),
            total_chat_count = count,
            first_error = ?failures.first().unwrap(),
            "Error searching group messages",
        );
    }

    let mut matches: Vec<MessageMatch> = successes.into_iter().flat_map(|r| r.matches).collect();

    matches.sort_unstable_by(|m1, m2| m2.score.cmp(&m1.score));

    matches.into_iter().take(max_results as usize).collect()
}
