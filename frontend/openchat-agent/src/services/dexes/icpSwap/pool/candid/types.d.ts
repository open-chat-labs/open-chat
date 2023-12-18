import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type Error = { 'CommonError' : null } |
  { 'InternalError' : string } |
  { 'UnsupportedToken' : string } |
  { 'InsufficientFunds' : null };
export interface QuoteArgs {
  'amountIn' : string,
  'zeroForOne' : boolean,
  'amountOutMinimum' : string,
}
export type QuoteResponse = { 'ok' : bigint } |
  { 'err' : Error };
export interface _SERVICE {
  'quoteForAll' : ActorMethod<[QuoteArgs], QuoteResponse>,
}
