use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/userIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(user_index, check_username);
    generate_ts_method!(user_index, chit_leaderboard);
    generate_ts_method!(user_index, current_user);
    generate_ts_method!(user_index, external_achievements);
    generate_ts_method!(user_index, diamond_membership_fees);
    generate_ts_method!(user_index, platform_moderators);
    generate_ts_method!(user_index, platform_moderators_group);
    generate_ts_method!(user_index, platform_operators);
    generate_ts_method!(user_index, public_key);
    generate_ts_method!(user_index, referral_metrics);
    generate_ts_method!(user_index, reported_messages);
    generate_ts_method!(user_index, search);
    generate_ts_method!(user_index, suspected_bots);
    generate_ts_method!(user_index, user);
    generate_ts_method!(user_index, user_registration_canister);
    generate_ts_method!(user_index, users);
    generate_ts_method!(user_index, users_chit);
    generate_ts_method!(user_index, update_diamond_membership_subscription);

    generate_ts_method!(user_index, pay_for_diamond_membership);
    generate_ts_method!(user_index, set_diamond_membership_fees);
    generate_ts_method!(user_index, set_display_name);
    generate_ts_method!(user_index, set_user_upgrade_concurrency);
    generate_ts_method!(user_index, set_moderation_flags);
    generate_ts_method!(user_index, set_username);
    generate_ts_method!(user_index, submit_proof_of_unique_personhood);
    generate_ts_method!(user_index, suspend_user);
    generate_ts_method!(user_index, unsuspend_user);
    generate_ts_method!(user_index, update_diamond_membership_subscription);
}
