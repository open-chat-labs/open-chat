use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(group_index, filter_groups, query);
    generate_candid_method!(group_index, recommended_groups, query);
    generate_candid_method!(group_index, search, query);

    generate_candid_method!(group_index, delete_frozen_group, update);
    generate_candid_method!(group_index, freeze_group, update);
    generate_candid_method!(group_index, unfreeze_group, update);
    generate_candid_method!(group_index, exclude_group_from_hotlist, update);
    generate_candid_method!(group_index, include_group_in_hotlist, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
