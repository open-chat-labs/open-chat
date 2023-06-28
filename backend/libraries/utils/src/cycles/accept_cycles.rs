use types::Cycles;

pub fn accept_cycles() -> Cycles {
    ic_cdk::api::call::msg_cycles_accept128(u64::MAX as u128)
}
