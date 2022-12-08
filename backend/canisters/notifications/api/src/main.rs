fn main() {
    candid::export_service!();
    std::print!("{}", __export_service());
}
