import type { IDL } from "@dfinity/candid";
import _SERVICE, {
  GetCurrentUserResponse,
  GetCurrentUserRequest,
} from "./canister_types";
export {
  _SERVICE as UserIndexService,
  GetCurrentUserResponse as ApiGetCurrentUserResponse,
  GetCurrentUserRequest as ApiGetCurrentUserRequest,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
