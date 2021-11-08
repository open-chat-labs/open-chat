use self::Response::*;
use crate::domain::blocked_users::{BlockedStatus, BlockedUsers};
use crate::domain::chat::{
    Chat, ChatEnum, ChatSummary, MessageContent, MessageContentValidationResponse, ReplyContext,
};
use crate::domain::chat_list::ChatList;
use crate::services::notifications::push_direct_message_notification;
use crate::services::notifications::push_group_message_notification;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::{timestamp, timestamp::Timestamp};

pub fn update(request: Request) -> Response {
    // Validation
    if let Some(response) = validate(&request) {
        return response;
    }

    let me = shared::user_id::get_current();
    let chat_list: &mut ChatList = storage::get_mut();

    {
        // Try to find the requested chat
        let chat = chat_list.get(request.chat_id, &me);

        if chat.is_none() {
            return ChatNotFound;
        }

        // Check whether either user blocks the other
        if let ChatEnum::Direct(dc) = chat.unwrap() {
            let blocked_users: &mut BlockedUsers = storage::get_mut();
            let blocked_status = blocked_users.blocked_status(&me, dc.get_other(&me));
            match blocked_status {
                BlockedStatus::Sender => return SenderBlocked,
                BlockedStatus::Recipient => return RecipientBlocked,
                BlockedStatus::Both => return RecipientBlocked,
                BlockedStatus::Unblocked => (),
            };
        }
    }

    {
        let now = timestamp::now();

        let message = chat_list
            .push_message(
                request.chat_id,
                &me,
                request.client_message_id,
                request.content,
                request.replies_to,
                now,
            )
            .unwrap();

        if let Some(chat) = chat_list.get(request.chat_id, &me) {
            let chat_summary = chat.to_summary(&me, 0);
            let message_id = message.get_id();

            // TODO: truncate the message text/caption to 200 chars.
            // A notification can only be 3800 chars. Only the first 150 or so chars are rendered in any case.

            if let Some(sender_name) = request.sender_name {
                match chat {
                    ChatEnum::Direct(direct) => {
                        let recipient = *direct.get_other(&me);

                        if !direct.notifications_muted(recipient) {
                            let notification = push_direct_message_notification::Notification {
                                chat_id: format!("{:x}", request.chat_id.0),
                                sender: me,
                                sender_name,
                                message,
                            };

                            push_direct_message_notification::fire_and_forget(
                                recipient,
                                notification,
                            );
                        }
                    }
                    ChatEnum::Group(group) => {
                        let recipients = group.notification_recipients(me);

                        if !recipients.is_empty() {
                            let notification = push_group_message_notification::Notification {
                                chat_id: format!("{:x}", request.chat_id.0),
                                group_name: group.subject().clone(),
                                sender: me,
                                sender_name,
                                message,
                            };

                            push_group_message_notification::fire_and_forget(
                                recipients,
                                notification,
                            );
                        }
                    }
                };
            }

            Success(Result::new(chat_summary, message_id, now))
        } else {
            ChatNotFound
        }
    }
}

fn validate(request: &Request) -> Option<Response> {
    if request.client_message_id.len() > 100 {
        return Some(Response::InvalidRequest);
    }
    match request.content.validate() {
        MessageContentValidationResponse::MessageTooLong(max) => return Some(MessageTooLong(max)),
        MessageContentValidationResponse::Invalid => return Some(InvalidRequest),
        MessageContentValidationResponse::Valid => (),
    }
    if let Some(reply) = &request.replies_to {
        match reply.get_content().validate() {
            MessageContentValidationResponse::Valid => (),
            _ => return Some(InvalidRequest),
        }
    }
    None
}

#[derive(Deserialize)]
pub struct Request {
    chat_id: ChatId,
    sender_name: Option<String>,
    client_message_id: String,
    content: MessageContent,
    replies_to: Option<ReplyContext>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
    ChatNotFound,
    MessageTooLong(u32),
    InvalidRequest,
    SenderBlocked,
    RecipientBlocked,
}

#[derive(CandidType)]
pub struct Result {
    chat_summary: ChatSummary,
    message_id: u32,
    timestamp: Timestamp,
}

impl Result {
    pub fn new(chat_summary: ChatSummary, message_id: u32, timestamp: Timestamp) -> Result {
        Result {
            chat_summary,
            message_id,
            timestamp,
        }
    }
}
