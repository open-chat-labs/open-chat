import type { Principal } from '@dfinity/principal';
export type CanisterId = Principal;
export interface ClaimRequest { 'code' : number, 'number' : PhoneNumber };
export type ClaimResponse = { 'Invalid' : null } |
  { 'Success' : { 'canister' : CanisterId } } |
  { 'Expired' : null };
export interface PhoneNumber { 'country_code' : number, 'number' : bigint };
export interface RegisterRequest { 'number' : PhoneNumber };
export type RegisterResponse = { 'Success' : null } |
  { 'Taken' : null } |
  { 'TooManyAttempts' : null };
export default interface _SERVICE {
  'claim' : (arg_0: ClaimRequest) => Promise<ClaimResponse>,
  'register' : (arg_0: RegisterRequest) => Promise<RegisterResponse>,
};
