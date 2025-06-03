use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/notificationsIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(notifications_index, fcm_token_exists);
    generate_ts_method!(notifications_index, subscription_exists);

    generate_ts_method!(notifications_index, add_fcm_token);
    generate_ts_method!(notifications_index, push_subscription);
    generate_ts_method!(notifications_index, remove_subscription);
    generate_ts_method!(notifications_index, remove_subscriptions_for_user);
}
