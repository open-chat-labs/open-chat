use candid_gen::generate_candid_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(notifications, notifications, query);
    generate_candid_method!(notifications, notifications_v1, query);

    candid::export_service!();
    std::print!("{}", __export_service());
}
