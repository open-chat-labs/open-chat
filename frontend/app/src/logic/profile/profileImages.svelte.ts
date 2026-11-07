// The user's photo and profile background as they change them, in the web's profile and the
// native Edit profile: the area picked in the image is cropped to the size it's saved at, shown
// at once (`preview`) while it uploads, and the saved one's URL takes over once the client has
// its id. One upload at a time for each: another would race it to the store (and the preview).

import type { Dimensions, OpenChat } from "@client";
import {
    AVATAR_SIZE,
    cropImage,
    PROFILE_BACKGROUND_SIZE,
    type CropArea,
    type CroppedImage,
} from "@src/utils/imageCrop";

export type ProfileImage = "avatar" | "cover";

/** The size each is saved at. */
export const PROFILE_IMAGE_SIZES: Record<ProfileImage, Dimensions> = {
    avatar: AVATAR_SIZE,
    cover: PROFILE_BACKGROUND_SIZE,
};

/** Why a change didn't save, as an i18n key. */
export const PROFILE_IMAGE_FAILURES: Record<ProfileImage, string> = {
    avatar: "avatarUpdateFailed",
    cover: "profile.backgroundUpdateFailed",
};

export type ProfileImageOutcome =
    | { kind: "saved" }
    // that image is still uploading: nothing's done
    | { kind: "busy" }
    // the image couldn't be cropped (not an image after all) or uploaded; its cause is logged
    | { kind: "failed"; reason: string };

type Crop = (source: string, area: CropArea, size: Dimensions) => Promise<CroppedImage | undefined>;

export class ProfileImages {
    #client: Pick<OpenChat, "setUserAvatar" | "setUserProfileBackground">;
    #crop: Crop;

    uploading = $state<Record<ProfileImage, boolean>>({ avatar: false, cover: false });
    // the cropped image, a data URL, while it uploads
    preview = $state<Partial<Record<ProfileImage, string>>>({});

    constructor(
        client: Pick<OpenChat, "setUserAvatar" | "setUserProfileBackground">,
        crop: Crop = cropImage,
    ) {
        this.#client = client;
        this.#crop = crop;
    }

    /**
     * Crops `area` of `source` (the picked image, a data URL) and saves it as the user's `target`,
     * at `size` (the native tree's cover is a banner, as components_mobile saves it).
     */
    async save(
        target: ProfileImage,
        source: string,
        area: CropArea,
        size: Dimensions = PROFILE_IMAGE_SIZES[target],
    ): Promise<ProfileImageOutcome> {
        if (this.uploading[target]) return { kind: "busy" };
        this.uploading[target] = true;
        try {
            // a file that isn't an image after all (a corrupt one, HEIC named .jpg) fails here
            const image = await this.#crop(source, area, size);
            if (image === undefined) throw new Error("the cropped image couldn't be encoded");
            this.preview[target] = image.url;
            const blobId =
                target === "avatar"
                    ? await this.#client.setUserAvatar(image.data, image.url)
                    : await this.#client.setUserProfileBackground(image.data);
            if (blobId === undefined) throw new Error("the upload failed");
            return { kind: "saved" };
        } catch (err) {
            console.warn(`Unable to save the ${target} image`, err);
            return { kind: "failed", reason: PROFILE_IMAGE_FAILURES[target] };
        } finally {
            // the saved image's URL from now on (the client has its id), or what was there before
            delete this.preview[target];
            this.uploading[target] = false;
        }
    }
}
