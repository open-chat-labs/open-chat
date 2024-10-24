use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(user, message_activity_feed, query);
    generate_candid_method!(user, bio, query);
    generate_candid_method!(user, cached_btc_address, query);
    generate_candid_method!(user, chit_events, query);
    generate_candid_method!(user, contacts, query);
    generate_candid_method!(user, deleted_message, query);
    generate_candid_method!(user, events, query);
    generate_candid_method!(user, events_by_index, query);
    generate_candid_method!(user, events_window, query);
    generate_candid_method!(user, hot_group_exclusions, query);
    generate_candid_method!(user, initial_state, query);
    generate_candid_method!(user, local_user_index, query);
    generate_candid_method!(user, messages_by_message_index, query);
    generate_candid_method!(user, public_profile, query);
    generate_candid_method!(user, search_messages, query);
    generate_candid_method!(user, saved_crypto_accounts, query);
    generate_candid_method!(user, token_swap_status, query);
    generate_candid_method!(user, updates, query);

    generate_candid_method!(user, accept_p2p_swap, update);
    generate_candid_method!(user, add_hot_group_exclusions, update);
    generate_candid_method!(user, add_reaction, update);
    generate_candid_method!(user, approve_transfer, update);
    generate_candid_method!(user, archive_unarchive_chats, update);
    generate_candid_method!(user, block_user, update);
    generate_candid_method!(user, btc_address, update);
    generate_candid_method!(user, cancel_message_reminder, update);
    generate_candid_method!(user, cancel_p2p_swap, update);
    generate_candid_method!(user, claim_daily_chit, update);
    generate_candid_method!(user, configure_wallet, update);
    generate_candid_method!(user, create_community, update);
    generate_candid_method!(user, create_group, update);
    generate_candid_method!(user, delete_community, update);
    generate_candid_method!(user, delete_direct_chat, update);
    generate_candid_method!(user, delete_group, update);
    generate_candid_method!(user, delete_messages, update);
    generate_candid_method!(user, edit_message_v2, update);
    generate_candid_method!(user, end_video_call, update);
    generate_candid_method!(user, join_video_call, update);
    generate_candid_method!(user, leave_community, update);
    generate_candid_method!(user, leave_group, update);
    generate_candid_method!(user, manage_favourite_chats, update);
    generate_candid_method!(user, mark_achievements_seen, update);
    generate_candid_method!(user, mark_message_activity_feed_read, update);
    generate_candid_method!(user, mark_read, update);
    generate_candid_method!(user, mute_notifications, update);
    generate_candid_method!(user, pin_chat_v2, update);
    generate_candid_method!(user, remove_reaction, update);
    generate_candid_method!(user, report_message, update);
    generate_candid_method!(user, retrieve_btc, update);
    generate_candid_method!(user, save_crypto_account, update);
    generate_candid_method!(user, send_message_with_transfer_to_channel, update);
    generate_candid_method!(user, send_message_with_transfer_to_group, update);
    generate_candid_method!(user, send_message_v2, update);
    generate_candid_method!(user, set_avatar, update);
    generate_candid_method!(user, set_bio, update);
    generate_candid_method!(user, set_community_indexes, update);
    generate_candid_method!(user, set_contact, update);
    generate_candid_method!(user, set_message_reminder_v2, update);
    generate_candid_method!(user, set_pin_number, update);
    generate_candid_method!(user, start_video_call, update);
    generate_candid_method!(user, submit_proposal, update);
    generate_candid_method!(user, swap_tokens, update);
    generate_candid_method!(user, tip_message, update);
    generate_candid_method!(user, unblock_user, update);
    generate_candid_method!(user, undelete_messages, update);
    generate_candid_method!(user, unmute_notifications, update);
    generate_candid_method!(user, unpin_chat_v2, update);
    generate_candid_method!(user, withdraw_crypto_v2, update);

    let directory = env::current_dir().unwrap().join("tsBindings/user");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(user, bio);
    generate_ts_method!(user, cached_btc_address);
    generate_ts_method!(user, chit_events);
    generate_ts_method!(user, contacts);
    generate_ts_method!(user, deleted_message);
    generate_ts_method!(user, events);
    generate_ts_method!(user, events_by_index);
    generate_ts_method!(user, events_window);
    generate_ts_method!(user, hot_group_exclusions);
    generate_ts_method!(user, initial_state);
    generate_ts_method!(user, local_user_index);
    generate_ts_method!(user, message_activity_feed);
    generate_ts_method!(user, messages_by_message_index);
    generate_ts_method!(user, public_profile);
    generate_ts_method!(user, search_messages);
    generate_ts_method!(user, saved_crypto_accounts);
    generate_ts_method!(user, token_swap_status);
    generate_ts_method!(user, token_swaps);
    generate_ts_method!(user, updates);

    generate_ts_method!(user, accept_p2p_swap);
    generate_ts_method!(user, add_hot_group_exclusions);
    generate_ts_method!(user, add_reaction);
    generate_ts_method!(user, approve_transfer);
    generate_ts_method!(user, archive_unarchive_chats);
    generate_ts_method!(user, block_user);
    generate_ts_method!(user, btc_address);
    generate_ts_method!(user, cancel_message_reminder);
    generate_ts_method!(user, cancel_p2p_swap);
    generate_ts_method!(user, claim_daily_chit);
    generate_ts_method!(user, configure_wallet);
    generate_ts_method!(user, create_community);
    generate_ts_method!(user, create_group);
    generate_ts_method!(user, delete_community);
    generate_ts_method!(user, delete_direct_chat);
    generate_ts_method!(user, delete_group);
    generate_ts_method!(user, delete_messages);
    generate_ts_method!(user, edit_message_v2);
    generate_ts_method!(user, end_video_call);
    generate_ts_method!(user, join_video_call);
    generate_ts_method!(user, leave_community);
    generate_ts_method!(user, leave_group);
    generate_ts_method!(user, manage_favourite_chats);
    generate_ts_method!(user, mark_achievements_seen);
    generate_ts_method!(user, mark_message_activity_feed_read);
    generate_ts_method!(user, mark_read);
    generate_ts_method!(user, mute_notifications);
    generate_ts_method!(user, pin_chat_v2);
    generate_ts_method!(user, remove_reaction);
    generate_ts_method!(user, reclaim_swap_tokens);
    generate_ts_method!(user, report_message);
    generate_ts_method!(user, retrieve_btc);
    generate_ts_method!(user, save_crypto_account);
    generate_ts_method!(user, send_message_with_transfer_to_channel);
    generate_ts_method!(user, send_message_with_transfer_to_group);
    generate_ts_method!(user, send_message_v2);
    generate_ts_method!(user, set_avatar);
    generate_ts_method!(user, set_bio);
    generate_ts_method!(user, set_community_indexes);
    generate_ts_method!(user, set_contact);
    generate_ts_method!(user, set_message_reminder_v2);
    generate_ts_method!(user, set_pin_number);
    generate_ts_method!(user, start_video_call);
    generate_ts_method!(user, submit_proposal);
    generate_ts_method!(user, swap_tokens);
    generate_ts_method!(user, tip_message);
    generate_ts_method!(user, unblock_user);
    generate_ts_method!(user, undelete_messages);
    generate_ts_method!(user, unmute_notifications);
    generate_ts_method!(user, unpin_chat_v2);
    generate_ts_method!(user, withdraw_crypto_v2);

    candid::export_service!();
    std::print!("{}", __export_service());
}
