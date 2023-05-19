use crate::guards::caller_is_local_user_index;
use crate::model::pending_actions_queue::Action;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use satoshi_dice_canister::c2c_add_user::{Response::*, *};
use types::{BlobReference, CanisterId, ImageContent, MessageContent, TextContent, ThumbnailData, UserId};

#[update_msgpack(guard = "caller_is_local_user_index")]
#[trace]
fn c2c_add_user(args: Args) -> Response {
    mutate_state(|state| c2c_add_user_impl(args.user_id, state))
}

pub(crate) fn c2c_add_user_impl(user_id: UserId, state: &mut RuntimeState) -> Response {
    state.data.users.add_user(user_id, state.env.now());
    state.enqueue_pending_action(Action::SendMessages(user_id, welcome_messages()));
    Success
}

fn welcome_messages() -> Vec<MessageContent> {
    Vec::from_iter([
        to_text_content("Hey there! I am the SatoshiDice chatbot!"),
        to_text_content("I am here to help you experiment with sending ckBTC as a chat message"),
        MessageContent::Image(ImageContent {
                width: 348,
                height: 402,
                thumbnail_data: ThumbnailData("data:image/png;base64,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".to_string()),
                caption: None,
                mime_type: "image/gif".to_string(),
                blob_reference: Some(BlobReference{
                    canister_id: CanisterId::from_text("m7ykd-3iaaa-aaaar-ad2uq-cai").unwrap(),
                    blob_id: 181941936289049620998958103384074922410,
                })
            }),
        to_text_content(
            "How to play:
✉️ Send me up to 0.0001 ckBTC in a single message
❗ Only send me ckBTC
🕰️ Wait a few moments 
🎉 I’ll send your ckBTC back with a surprise bonus on top!",
        ),
        to_text_content("Start playing now! 🎲"),
    ])
}

fn to_text_content(str: &str) -> MessageContent {
    MessageContent::Text(TextContent { text: str.to_string() })
}
