use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(group_index, active_groups, query);
    generate_candid_method!(group_index, explore_communities, query);
    generate_candid_method!(group_index, explore_groups, query);
    generate_candid_method!(group_index, lookup_channel_by_group_id, query);
    generate_candid_method!(group_index, recommended_groups, query);
    generate_candid_method!(group_index, search, query);

    generate_candid_method!(group_index, delete_frozen_group, update);
    generate_candid_method!(group_index, freeze_group, update);
    generate_candid_method!(group_index, freeze_community, update);
    generate_candid_method!(group_index, unfreeze_group, update);
    generate_candid_method!(group_index, unfreeze_community, update);
    generate_candid_method!(group_index, add_hot_group_exclusion, update);
    generate_candid_method!(group_index, remove_hot_group_exclusion, update);
    generate_candid_method!(group_index, set_community_moderation_flags, update);
    generate_candid_method!(group_index, set_community_upgrade_concurrency, update);
    generate_candid_method!(group_index, set_group_upgrade_concurrency, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
