use candid::Principal;
use types::{DirectMessageNotification, EventWrapper, Message, MessageContent, Notification, TextContent};

fn main() {
    let ignored = Notification::DirectMessageNotification(DirectMessageNotification {
        sender: Principal::anonymous().into(),
        thread_root_message_index: None,
        sender_name: "".to_string(),
        message: EventWrapper {
            index: 0.into(),
            timestamp: 0,
            correlation_id: 0,
            expires_at: None,
            event: Message {
                message_index: 0.into(),
                message_id: 0.into(),
                sender: Principal::anonymous().into(),
                content: MessageContent::Text(TextContent { text: "".to_string() }),
                replies_to: None,
                reactions: Vec::new(),
                edited: false,
                forwarded: false,
                thread_summary: None,
                last_updated: None,
            },
        },
    });
    let candid_type = candid::types::internal::get_type(&ignored);
    let candid = candid::bindings::candid::pp_ty(&candid_type);
    std::print!("type Notification = {}", candid.pretty(120));
}
