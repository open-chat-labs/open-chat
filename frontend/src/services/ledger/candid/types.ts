import type { Principal } from '@dfinity/principal';
export interface AccountBalanceArgs { 'account' : AccountIdentifier }
export type AccountIdentifier = Array<number>;
export interface Tokens { 'e8s' : bigint }
export interface _SERVICE {
  'account_balance' : (arg_0: AccountBalanceArgs) => Promise<Tokens>,
}
