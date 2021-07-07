use super::chats::Response::*;
use crate::model::message::Message;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use itertools::Itertools;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::{DirectChatId, GroupChatId};
use shared::types::UserId;

pub fn query(args: Args, runtime_state: &RuntimeState) -> Response {
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
                    chat_id: c.chat_id(&runtime_state.env.owner_user_id()),
                    them: c.them,
                    latest_message: c.messages.last().unwrap().clone(),
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

#[derive(Deserialize)]
pub struct Args {
    updated_since: Option<TimestampMillis>,
}

#[derive(CandidType)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType)]
pub struct SuccessResult {
    chats: Vec<ChatSummary>,
    timestamp: TimestampMillis,
}

#[allow(dead_code)]
#[derive(CandidType)]
pub enum ChatSummary {
    Direct(DirectChatSummary),
    Group(GroupChatSummary),
}

impl ChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        match self {
            ChatSummary::Direct(d) => d.display_date(),
            ChatSummary::Group(g) => g.display_date(),
        }
    }
}

#[derive(CandidType)]
pub struct DirectChatSummary {
    pub them: UserId,
    pub chat_id: DirectChatId,
    pub latest_message: Message,
    pub date_created: TimestampMillis,
}

impl DirectChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.timestamp
    }
}

#[derive(CandidType)]
pub struct GroupChatSummary {
    pub name: String,
    pub chat_id: GroupChatId,
    pub latest_message: Option<Message>,
    pub date_added: TimestampMillis,
}

impl GroupChatSummary {
    pub fn display_date(&self) -> TimestampMillis {
        self.latest_message.as_ref().map_or(self.date_added, |m| m.timestamp)
    }
}
