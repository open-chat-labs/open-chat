import type { GetCurrentUserResponse } from "../../domain/user";
import type { IUserService } from "./user.service.interface";

export class UserServiceMock implements IUserService {
    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return Promise.resolve({
            kind: "unknown",
        });
    }
}
