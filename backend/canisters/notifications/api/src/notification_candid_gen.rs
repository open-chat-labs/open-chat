use candid::Principal;
use types::{DirectMessageNotification, Notification};

fn main() {
    let ignored = Notification::DirectMessage(DirectMessageNotification {
        sender: Principal::anonymous().into(),
        thread_root_message_index: None,
        message_index: 0.into(),
        event_index: 0.into(),
        sender_name: "".to_string(),
        sender_display_name: None,
        message_type: "".to_string(),
        message_text: None,
        image_url: None,
        sender_avatar_id: None,
        crypto_transfer: None,
    });
    let candid_type = candid::types::internal::get_type(&ignored);
    let candid = candid::pretty::candid::pp_ty(&candid_type);
    std::print!("type Notification = {}", candid.pretty(120));
}
