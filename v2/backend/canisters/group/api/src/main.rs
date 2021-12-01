use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(group, events, query);
    generate_candid_method!(group, events_by_index, query);
    generate_candid_method!(group, events_range, query);
    generate_candid_method!(group, events_window, query);
    generate_candid_method!(group, search_messages, query);
    generate_candid_method!(group, selected_initial, query);
    generate_candid_method!(group, selected_updates, query);

    generate_candid_method!(group, add_participants, update);
    generate_candid_method!(group, block_user, update);
    generate_candid_method!(group, delete_group, update);
    generate_candid_method!(group, delete_messages, update);
    generate_candid_method!(group, dismiss_admin, update);
    generate_candid_method!(group, edit_message, update);
    generate_candid_method!(group, make_admin, update);
    generate_candid_method!(group, remove_participant, update);
    generate_candid_method!(group, send_message, update);
    generate_candid_method!(group, toggle_reaction, update);
    generate_candid_method!(group, transfer_ownership, update);
    generate_candid_method!(group, unblock_user, update);
    generate_candid_method!(group, update_group, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
