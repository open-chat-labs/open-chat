import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';

export type FunctionType = { 'NativeNervousSystemFunction' : {} } |
  { 'GenericNervousSystemFunction' : GenericNervousSystemFunction };
export interface GenericNervousSystemFunction {
  'validator_canister_id' : [] | [Principal],
  'target_canister_id' : [] | [Principal],
  'validator_method_name' : [] | [string],
  'target_method_name' : [] | [string],
}
export interface ListNervousSystemFunctionsResponse {
  'reserved_ids' : BigUint64Array,
  'functions' : Array<NervousSystemFunction>,
}
export interface NervousSystemFunction {
  'id' : bigint,
  'name' : string,
  'description' : [] | [string],
  'function_type' : [] | [FunctionType],
}
export interface _SERVICE {
  'list_nervous_system_functions' : ActorMethod<
    [],
    ListNervousSystemFunctionsResponse,
  >,
}
