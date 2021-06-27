import type { GetCurrentUserResponse } from "../../domain/user";

export interface IUserService {
    getCurrentUser: () => Promise<GetCurrentUserResponse>;
}
