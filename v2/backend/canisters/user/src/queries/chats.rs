use super::chats::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use ic_cdk_macros::query;
use itertools::Itertools;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::UserId;

#[derive(Deserialize)]
struct Args {
    updated_since: Option<TimestampMillis>,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
struct SuccessResult {
    chats: Vec<ChatSummary>,
    timestamp: TimestampMillis,
}

#[query]
fn chats(args: Args) -> Response {
    RUNTIME_STATE.with(|state| chats_impl(args, state.borrow().as_ref().unwrap()))
}

fn chats_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let direct_chats = runtime_state
            .data
            .direct_chats
            .values()
            .filter(
                |&c| {
                    if let Some(updated_since) = args.updated_since {
                        c.last_updated() > updated_since
                    } else {
                        true
                    }
                },
            )
            .map(|c| {
                ChatSummary::Direct(DirectChatSummary {
                    chat_id: c.chat_id,
                    them: c.them,
                    latest_message: c.messages.hydrate_message(c.messages.last().unwrap()),
                    date_created: c.date_created,
                })
            })
            .sorted_unstable_by_key(|s| s.display_date())
            .collect();

        Success(SuccessResult {
            chats: direct_chats,
            timestamp: runtime_state.env.now(),
        })
    } else {
        NotAuthorised
    }
}

#[allow(dead_code)]
#[derive(CandidType)]
enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary),
}

impl ChatSummary {
    fn display_date(&self) -> TimestampMillis {
        match self {
            ChatSummary::Direct(d) => d.display_date(),
            ChatSummary::Group(g) => g.display_date(),
        }
    }
}

#[derive(CandidType)]
struct DirectChatSummary {
    them: UserId,
    chat_id: DirectChatId,
    latest_message: Message,
    date_created: TimestampMillis,
}

impl DirectChatSummary {
    fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType)]
struct GroupChatSummary {
    name: String,
    chat_id: GroupChatId,
    latest_message: Option<Message>,
    date_added: TimestampMillis,
}

impl GroupChatSummary {
    fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.date_added, |m| m.timestamp)
    }
}
