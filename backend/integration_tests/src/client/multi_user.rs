use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::c2c_create_user;
use user_canister::{
    archive_unarchive_chats, bio, delete_direct_chat, events, events_by_index, events_window, initial_state, mark_read,
    mute_notifications, pin_chat_v2, send_message_v2, unmute_notifications, unpin_chat_v2, updates,
};

// Queries
generate_msgpack_query_call!(bio);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(initial_state);
generate_msgpack_query_call!(updates);

// Updates
generate_msgpack_update_call!(archive_unarchive_chats);
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(delete_direct_chat);
generate_msgpack_update_call!(mark_read);
generate_msgpack_update_call!(mute_notifications);
generate_msgpack_update_call!(pin_chat_v2);
generate_msgpack_update_call!(send_message_v2);
generate_msgpack_update_call!(unmute_notifications);
generate_msgpack_update_call!(unpin_chat_v2);
