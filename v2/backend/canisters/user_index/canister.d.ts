import type { IDL } from "@dfinity/candid";
import UserIndexService, {
  GetCurrentUserResponse,
  GetCurrentUserRequest,
  UpdateUsernameRequest,
  UpdateUsernameResponse,
} from "./canister_types";
export {
  UserIndexService,
  GetCurrentUserResponse as ApiGetCurrentUserResponse,
  GetCurrentUserRequest as ApiGetCurrentUserRequest,
  UpdateUsernameRequest as ApiUpdateUsernameRequest,
  UpdateUsernameResponse as ApiUpdateUsernameResponse,
};

declare const idlFactory: IDL.InterfaceFactory;
export default idlFactory;
