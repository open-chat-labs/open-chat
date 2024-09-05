use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(notifications_index, subscription_exists, query);

    generate_candid_method!(notifications_index, push_subscription, update);
    generate_candid_method!(notifications_index, remove_subscription, update);
    generate_candid_method!(notifications_index, remove_subscriptions_for_user, update);

    let directory = env::current_dir().unwrap().join("tsBindings/notificationsIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(notifications_index, subscription_exists);

    generate_ts_method!(notifications_index, push_subscription);
    generate_ts_method!(notifications_index, remove_subscription);
    generate_ts_method!(notifications_index, remove_subscriptions_for_user);

    candid::export_service!();
    std::print!("{}", __export_service());
}
