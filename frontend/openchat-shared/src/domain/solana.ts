// What the ckSOL minter asks of deposits: it only sweeps a deposit address, crediting its SOL as
// ckSOL, once the address holds at least `minimumDepositAmount` lamports
export type CksolMinterDepositInfo = {
    minimumDepositAmount: bigint;
};
