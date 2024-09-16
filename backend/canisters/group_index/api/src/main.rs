use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/groupIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(group_index, active_groups);
    generate_ts_method!(group_index, active_groups);
    generate_ts_method!(group_index, explore_communities);
    generate_ts_method!(group_index, explore_groups);
    generate_ts_method!(group_index, lookup_channel_by_group_id);
    generate_ts_method!(group_index, recommended_groups);

    generate_ts_method!(group_index, add_hot_group_exclusion);
    generate_ts_method!(group_index, delete_frozen_group);
    generate_ts_method!(group_index, freeze_community);
    generate_ts_method!(group_index, freeze_group);
    generate_ts_method!(group_index, mark_local_group_index_full);
    generate_ts_method!(group_index, remove_hot_group_exclusion);
    generate_ts_method!(group_index, set_community_moderation_flags);
    generate_ts_method!(group_index, set_community_upgrade_concurrency);
    generate_ts_method!(group_index, set_group_upgrade_concurrency);
    generate_ts_method!(group_index, unfreeze_community);
    generate_ts_method!(group_index, unfreeze_group);
}
