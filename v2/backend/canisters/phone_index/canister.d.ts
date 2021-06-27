import type { IDL } from "@dfinity/candid";
import _SERVICE, {
  RegisterRequest,
  RegisterResponse,
  ClaimRequest,
  ClaimResponse,
  PhoneNumber,
  CanisterId,
} from "./canister_types";
export {
  _SERVICE as PhoneIndexService,
  RegisterRequest as ApiRegisterRequest,
  RegisterResponse as ApiRegisterResponse,
  ClaimRequest as ApiClaimRequest,
  ClaimResponse as ApiClaimResponse,
  PhoneNumber as ApiPhoneNumber,
  CanisterId as ApiCanisterId,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
