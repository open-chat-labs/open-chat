use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(translations, pending_deployment, query);
    generate_candid_method!(translations, proposed, query);

    generate_candid_method!(translations, approve, update);
    generate_candid_method!(translations, mark_deployed, update);
    generate_candid_method!(translations, propose, update);
    generate_candid_method!(translations, reject, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
