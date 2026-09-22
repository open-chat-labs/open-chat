use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::{c2c_create_user, c2c_delete_user};
use user_canister::{
    add_hot_group_exclusions, add_reaction, archive_unarchive_chats, bio, block_user, c2c_pay_for_premium_item,
    cancel_message_reminder, chit_events, claim_daily_chit, configure_wallet, contacts, delete_direct_chat, delete_messages,
    delete_saved_crypto_account, deleted_message, edit_message_v2, events, events_by_index, events_window,
    hot_group_exclusions, initial_state, local_user_index, manage_favourite_chats, mark_achievements_seen,
    mark_message_activity_feed_read, mark_read, message_activity_feed, messages_by_message_index, mute_notifications,
    pay_for_streak_insurance, pin_chat_v2, public_profile, remove_reaction, report_message, save_crypto_account,
    saved_crypto_accounts, search_messages, send_message_v2, set_avatar, set_bio, set_contact, set_message_reminder_v2,
    set_pin_number, set_profile_background, unblock_user, undelete_messages, unmute_notifications, unpin_chat_v2,
    update_chat_settings, updates,
};
use user_canister::{
    c2c_community_canister_v2, c2c_game_chit, c2c_group_canister_v2, c2c_groups_and_communities, c2c_local_user_index_v2,
    c2c_notify_community_deleted, c2c_notify_group_deleted, c2c_remove_from_group, c2c_set_user_suspended,
    c2c_user_canister_v2, set_community_indexes,
};

// Queries
generate_msgpack_query_call!(bio);
generate_msgpack_query_call!(c2c_groups_and_communities);
generate_msgpack_query_call!(chit_events);
generate_msgpack_query_call!(contacts);
generate_msgpack_query_call!(deleted_message);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);
generate_msgpack_query_call!(hot_group_exclusions);
generate_msgpack_query_call!(initial_state);
generate_msgpack_query_call!(local_user_index);
generate_msgpack_query_call!(message_activity_feed);
generate_msgpack_query_call!(messages_by_message_index);
generate_msgpack_query_call!(public_profile);
generate_msgpack_query_call!(saved_crypto_accounts);
generate_msgpack_query_call!(search_messages);
generate_msgpack_query_call!(updates);

// Updates
generate_msgpack_update_call!(add_hot_group_exclusions);
generate_msgpack_update_call!(add_reaction);
generate_msgpack_update_call!(archive_unarchive_chats);
generate_msgpack_update_call!(block_user);
generate_msgpack_update_call!(c2c_community_canister_v2);
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(c2c_delete_user);
generate_msgpack_update_call!(c2c_game_chit);
generate_msgpack_update_call!(c2c_group_canister_v2);
generate_msgpack_update_call!(c2c_local_user_index_v2);
generate_msgpack_update_call!(c2c_notify_community_deleted);
generate_msgpack_update_call!(c2c_notify_group_deleted);
generate_msgpack_update_call!(c2c_pay_for_premium_item);
generate_msgpack_update_call!(c2c_remove_from_group);
generate_msgpack_update_call!(c2c_set_user_suspended);
generate_msgpack_update_call!(c2c_user_canister_v2);
generate_msgpack_update_call!(cancel_message_reminder);
generate_msgpack_update_call!(claim_daily_chit);
generate_msgpack_update_call!(configure_wallet);
generate_msgpack_update_call!(delete_direct_chat);
generate_msgpack_update_call!(delete_messages);
generate_msgpack_update_call!(delete_saved_crypto_account);
generate_msgpack_update_call!(edit_message_v2);
generate_msgpack_update_call!(manage_favourite_chats);
generate_msgpack_update_call!(mark_achievements_seen);
generate_msgpack_update_call!(mark_message_activity_feed_read);
generate_msgpack_update_call!(mark_read);
generate_msgpack_update_call!(mute_notifications);
generate_msgpack_update_call!(pay_for_streak_insurance);
generate_msgpack_update_call!(pin_chat_v2);
generate_msgpack_update_call!(remove_reaction);
generate_msgpack_update_call!(report_message);
generate_msgpack_update_call!(save_crypto_account);
generate_msgpack_update_call!(send_message_v2);
generate_msgpack_update_call!(set_avatar);
generate_msgpack_update_call!(set_bio);
generate_msgpack_update_call!(set_community_indexes);
generate_msgpack_update_call!(set_contact);
generate_msgpack_update_call!(set_message_reminder_v2);
generate_msgpack_update_call!(set_pin_number);
generate_msgpack_update_call!(set_profile_background);
generate_msgpack_update_call!(unblock_user);
generate_msgpack_update_call!(undelete_messages);
generate_msgpack_update_call!(unmute_notifications);
generate_msgpack_update_call!(unpin_chat_v2);
generate_msgpack_update_call!(update_chat_settings);
