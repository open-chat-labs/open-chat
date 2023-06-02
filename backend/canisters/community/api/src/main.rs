use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(community, deleted_message, query);
    generate_candid_method!(community, events, query);
    generate_candid_method!(community, events_by_index, query);
    generate_candid_method!(community, events_window, query);
    generate_candid_method!(community, invite_code, query);
    generate_candid_method!(community, local_user_index, query);
    generate_candid_method!(community, messages_by_message_index, query);
    generate_candid_method!(community, rules, query);
    generate_candid_method!(community, search_channel, query);

    generate_candid_method!(community, add_members_to_channel, update);
    generate_candid_method!(community, add_reaction, update);
    generate_candid_method!(community, block_user, update);
    generate_candid_method!(community, change_channel_role, update);
    generate_candid_method!(community, change_role, update);
    generate_candid_method!(community, create_channel, update);
    generate_candid_method!(community, decline_invitation, update);
    generate_candid_method!(community, delete_channel, update);
    generate_candid_method!(community, delete_messages, update);
    generate_candid_method!(community, disable_invite_code, update);
    generate_candid_method!(community, edit_message, update);
    generate_candid_method!(community, enable_invite_code, update);
    generate_candid_method!(community, join_channel, update);
    generate_candid_method!(community, leave_channel, update);
    generate_candid_method!(community, make_channel_private, update);
    generate_candid_method!(community, make_private, update);
    generate_candid_method!(community, pin_message, update);
    generate_candid_method!(community, remove_member, update);
    generate_candid_method!(community, remove_member_from_channel, update);
    generate_candid_method!(community, remove_reaction, update);
    generate_candid_method!(community, reset_invite_code, update);
    generate_candid_method!(community, send_message, update);
    generate_candid_method!(community, toggle_mute_channel_notifications, update);
    generate_candid_method!(community, toggle_mute_notifications, update);
    generate_candid_method!(community, unblock_user, update);
    generate_candid_method!(community, undelete_messages, update);
    generate_candid_method!(community, update_channel, update);
    generate_candid_method!(community, update_community, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
