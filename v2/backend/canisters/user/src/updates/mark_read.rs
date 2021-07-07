use super::mark_read::Response::*;
use crate::model::runtime_state::RuntimeState;
use candid::CandidType;
use serde::Deserialize;
use shared::types::chat_id::DirectChatId;
use shared::types::{MessageId, UserId};

pub fn update(args: &Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &args.user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
            if chat.read_up_to < args.up_to_message_id {
                chat.read_up_to = args.up_to_message_id;
                Success
            } else {
                SuccessNoChange
            }
        } else {
            ChatNotFound
        }
    } else {
        NotAuthorised
    }
}

#[derive(Deserialize)]
pub struct Args {
    user_id: UserId,
    up_to_message_id: MessageId,
}

#[derive(CandidType)]
pub enum Response {
    Success,
    SuccessNoChange,
    ChatNotFound,
    NotAuthorised,
}

pub mod c2c {
    use super::*;
    use crate::model::runtime_state::RuntimeState;
    use shared::types::{CanisterId, MessageId};

    pub async fn call(canister_id: CanisterId, args: Args) -> Result<Response, String> {
        let (res,): (Response,) = ic_cdk::call(canister_id, "handle_mark_read", (args,))
            .await
            .map_err(|e| e.1)?;

        Ok(res)
    }

    pub fn update(args: Args, runtime_state: &mut RuntimeState) -> Response {
        let their_user_id = runtime_state.env.caller().into();

        let chat_id = DirectChatId::from((&runtime_state.env.owner_user_id(), &their_user_id));
        if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
            if chat.read_up_to_by_them < args.up_to_message_id {
                chat.read_up_to_by_them = args.up_to_message_id;
                Response::Success
            } else {
                Response::SuccessNoChange
            }
        } else {
            Response::ChatNotFound
        }
    }

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        up_to_message_id: MessageId,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success,
        SuccessNoChange,
        ChatNotFound,
    }

    impl From<super::Args> for (CanisterId, Args) {
        fn from(args: super::Args) -> Self {
            let c2c_args = Args {
                up_to_message_id: args.up_to_message_id,
            };

            (args.user_id.into(), c2c_args)
        }
    }
}
