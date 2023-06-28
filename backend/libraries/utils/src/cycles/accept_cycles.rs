use types::Cycles;

pub fn accept_cycles() -> Cycles {
    let cycles_accepted = ic_cdk::api::call::msg_cycles_accept128(u64::MAX as u128);
    cycles_accepted.into()
}
