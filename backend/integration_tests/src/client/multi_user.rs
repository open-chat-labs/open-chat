use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::c2c_create_user;
use user_canister::{
    archive_unarchive_chats, bio, block_user, configure_wallet, contacts, delete_direct_chat, events, events_by_index,
    events_window, initial_state, manage_favourite_chats, mark_read, mute_notifications, pin_chat_v2, public_profile,
    send_message_v2, set_avatar, set_bio, set_contact, set_profile_background, unblock_user, unmute_notifications,
    unpin_chat_v2, updates,
};

// Queries
generate_msgpack_query_call!(bio);
generate_msgpack_query_call!(contacts);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(initial_state);
generate_msgpack_query_call!(public_profile);
generate_msgpack_query_call!(updates);

// Updates
generate_msgpack_update_call!(archive_unarchive_chats);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(configure_wallet);
generate_msgpack_update_call!(delete_direct_chat);
generate_msgpack_update_call!(manage_favourite_chats);
generate_msgpack_update_call!(mark_read);
generate_msgpack_update_call!(mute_notifications);
generate_msgpack_update_call!(pin_chat_v2);
generate_msgpack_update_call!(send_message_v2);
generate_msgpack_update_call!(set_avatar);
generate_msgpack_update_call!(set_bio);
generate_msgpack_update_call!(set_contact);
generate_msgpack_update_call!(set_profile_background);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(unmute_notifications);
generate_msgpack_update_call!(unpin_chat_v2);
