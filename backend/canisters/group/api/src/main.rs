use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(group, events, query);
    generate_candid_method!(group, events_by_index, query);
    generate_candid_method!(group, events_range, query);
    generate_candid_method!(group, events_window, query);
    generate_candid_method!(group, messages_by_message_index, query);
    generate_candid_method!(group, invite_code, query);
    generate_candid_method!(group, public_summary, query);
    generate_candid_method!(group, search_messages, query);
    generate_candid_method!(group, selected_initial, query);
    generate_candid_method!(group, selected_updates, query);

    generate_candid_method!(group, add_participants, update);
    generate_candid_method!(group, block_user, update);
    generate_candid_method!(group, change_role, update);
    generate_candid_method!(group, delete_group, update);
    generate_candid_method!(group, delete_messages, update);
    generate_candid_method!(group, disable_invite_code, update);
    generate_candid_method!(group, edit_message, update);
    generate_candid_method!(group, enable_invite_code, update);
    generate_candid_method!(group, make_private, update);
    generate_candid_method!(group, pin_message, update);
    generate_candid_method!(group, register_poll_vote, update);
    generate_candid_method!(group, remove_participant, update);
    generate_candid_method!(group, reset_invite_code, update);
    generate_candid_method!(group, send_message, update);
    generate_candid_method!(group, toggle_reaction, update);
    generate_candid_method!(group, unblock_user, update);
    generate_candid_method!(group, unpin_message, update);
    generate_candid_method!(group, update_group, update);
    generate_candid_method!(group, update_permissions, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
