use candid::Principal;
use types::{DirectMessageNotification, Message, MessageContent, Notification, TextContent};

fn main() {
    let ignored = Notification::DirectMessageNotification(DirectMessageNotification {
        sender: Principal::anonymous().into(),
        sender_name: "".to_string(),
        message: Message {
            message_index: 0.into(),
            message_id: 0.into(),
            sender: Principal::anonymous().into(),
            content: MessageContent::Text(TextContent { text: "".to_string() }),
            replies_to: None,
            reactions: Vec::new(),
            edited: false,
        },
    });
    let candid_type = candid::types::internal::get_type(&ignored);
    let candid = candid::bindings::candid::pp_ty(&candid_type);
    std::print!("type Notification = {}", candid.pretty(120));
}
