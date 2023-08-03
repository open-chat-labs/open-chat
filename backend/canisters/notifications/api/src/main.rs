use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(notifications, notification_candid_check, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
