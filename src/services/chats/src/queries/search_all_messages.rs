use self::Response::*;
use crate::domain::chat::{Chat, Message};
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::chat_id::ChatId;

pub fn query(search_term: &str, max_results: u8) -> Response {
    let chat_list: &ChatList = storage::get();
    let me = shared::user_id::get_current();
    let chats = chat_list.get_all(&me);

    let mut matches: Vec<Match> = Vec::new();
    for chat in chats {
        for message in chat.search_messages(search_term, &me) {
            matches.push(Match {
                chat_id: chat.get_id(),
                message,
            });
        }
    }

    matches.sort_unstable_by(|x, y| y.message.get_timestamp().cmp(&x.message.get_timestamp()));

    let result = Result {
        matches: matches.into_iter().take(max_results as usize).collect(),
    };

    Success(result)
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    matches: Vec<Match>,
}

#[derive(CandidType)]
pub struct Match {
    chat_id: ChatId,
    message: Message,
}
