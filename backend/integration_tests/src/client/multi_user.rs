use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::c2c_create_user;
use user_canister::{
    add_reaction, archive_unarchive_chats, bio, block_user, configure_wallet, contacts, delete_direct_chat, delete_messages,
    deleted_message, edit_message_v2, events, events_by_index, events_window, initial_state, manage_favourite_chats,
    mark_message_activity_feed_read, mark_read, message_activity_feed, messages_by_message_index, mute_notifications,
    pin_chat_v2, public_profile, remove_reaction, search_messages, send_message_v2, set_avatar, set_bio, set_contact,
    set_profile_background, unblock_user, undelete_messages, unmute_notifications, unpin_chat_v2, update_chat_settings,
    updates,
};

// Queries
generate_msgpack_query_call!(bio);
generate_msgpack_query_call!(contacts);
generate_msgpack_query_call!(deleted_message);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(initial_state);
generate_msgpack_query_call!(message_activity_feed);
generate_msgpack_query_call!(messages_by_message_index);
generate_msgpack_query_call!(public_profile);
generate_msgpack_query_call!(search_messages);
generate_msgpack_query_call!(updates);

// Updates
generate_msgpack_update_call!(add_reaction);
generate_msgpack_update_call!(archive_unarchive_chats);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(configure_wallet);
generate_msgpack_update_call!(delete_direct_chat);
generate_msgpack_update_call!(delete_messages);
generate_msgpack_update_call!(edit_message_v2);
generate_msgpack_update_call!(manage_favourite_chats);
generate_msgpack_update_call!(mark_message_activity_feed_read);
generate_msgpack_update_call!(mark_read);
generate_msgpack_update_call!(mute_notifications);
generate_msgpack_update_call!(pin_chat_v2);
generate_msgpack_update_call!(remove_reaction);
generate_msgpack_update_call!(send_message_v2);
generate_msgpack_update_call!(set_avatar);
generate_msgpack_update_call!(set_bio);
generate_msgpack_update_call!(set_contact);
generate_msgpack_update_call!(set_profile_background);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(undelete_messages);
generate_msgpack_update_call!(unmute_notifications);
generate_msgpack_update_call!(unpin_chat_v2);
generate_msgpack_update_call!(update_chat_settings);
