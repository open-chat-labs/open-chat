use types::Cycles;

// This only applies to the 'top level' canisters (ie. not user + group canisters)
pub const MIN_CYCLES_BALANCE: Cycles = 5_000_000_000_000; // 5T
pub const CREATE_CANISTER_CYCLES_FEE: Cycles = 100_000_000_000; // 0.1T cycles
pub const CYCLES_REQUIRED_FOR_UPGRADE: Cycles = 80_000_000_000; // 0.08T cycles
