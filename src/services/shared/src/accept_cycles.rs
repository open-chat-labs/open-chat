pub fn accept_cycles() -> u128 {
    let cycles_available = ic_cdk::api::call::msg_cycles_available();
    let cycles_accepted = ic_cdk::api::call::msg_cycles_accept(cycles_available);
    cycles_accepted as u128
}
