import type { IDL } from "@dfinity/candid";
import PhoneIndexService, {
  RegisterRequest,
  RegisterResponse,
  ClaimRequest,
  ClaimResponse,
  PhoneNumber,
  CanisterId,
} from "./canister_types";
export {
  PhoneIndexService,
  RegisterRequest as ApiRegisterRequest,
  RegisterResponse as ApiRegisterResponse,
  ClaimRequest as ApiClaimRequest,
  ClaimResponse as ApiClaimResponse,
  PhoneNumber as ApiPhoneNumber,
  CanisterId as ApiCanisterId,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
