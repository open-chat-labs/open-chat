import type { IDL } from "@dfinity/candid";
import UserIndexService, {
  GetCurrentUserResponse,
  GetCurrentUserRequest,
  CreateUserResponse,
  CreateUserRequest,
} from "./canister_types";
export {
  UserIndexService,
  GetCurrentUserResponse as ApiGetCurrentUserResponse,
  GetCurrentUserRequest as ApiGetCurrentUserRequest,
  CreateUserRequest as ApiCreateUserRequest,
  CreateUserResponse as ApiCreateUserResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
