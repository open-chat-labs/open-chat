use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(notifications_index, subscription_exists, query);

    generate_candid_method!(notifications_index, push_subscription, update);
    generate_candid_method!(notifications_index, remove_subscription, update);
    generate_candid_method!(notifications_index, remove_subscriptions_for_user, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
