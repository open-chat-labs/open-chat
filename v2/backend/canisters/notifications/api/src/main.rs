use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(notifications, subscription_exists, query);

    generate_candid_method!(notifications, push_subscription, update);
    generate_candid_method!(notifications, remove_subscription, update);
    generate_candid_method!(notifications, remove_subscriptions_for_user, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
