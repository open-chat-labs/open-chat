import { describe, expect, test, vi } from "vitest";
import { ProfileImages } from "./profileImages.svelte";

const AREA = { x: 0, y: 0, width: 10, height: 10 };
const IMAGE = { url: "data:image/png;cropped", data: new Uint8Array([1]) };

function setup(uploads = true) {
    const blobId = uploads ? 1n : undefined;
    let release: () => void = () => {};
    const uploaded = new Promise<void>((resolve) => (release = resolve));
    const client = {
        setUserAvatar: vi.fn(async () => {
            await uploaded;
            return blobId;
        }),
        setUserProfileBackground: vi.fn(async () => blobId),
    };
    const crop = vi.fn(async () => IMAGE);
    return { images: new ProfileImages(client, crop), client, crop, release };
}

describe("changing the profile's images", () => {
    test("crops to the saved size, previews it while it uploads, then lets the saved one show", async () => {
        const { images, client, crop, release } = setup();
        const saving = images.save("avatar", "data:source", AREA);
        await vi.waitFor(() => expect(client.setUserAvatar).toHaveBeenCalled());
        expect(crop).toHaveBeenCalledWith("data:source", AREA, { width: 150, height: 150 });
        expect(images.preview.avatar).toBe(IMAGE.url);
        expect(images.uploading.avatar).toBe(true);
        release();
        expect(await saving).toEqual({ kind: "saved" });
        expect(images.preview.avatar).toBeUndefined();
        expect(images.uploading.avatar).toBe(false);
    });

    test("one at a time for each image", async () => {
        const { images, release } = setup();
        const first = images.save("avatar", "data:a", AREA);
        expect(await images.save("avatar", "data:b", AREA)).toEqual({ kind: "busy" });
        // the background isn't held up by the photo
        expect(await images.save("cover", "data:c", AREA)).toEqual({ kind: "saved" });
        release();
        await first;
    });

    test("the background is saved as the profile background, at its size", async () => {
        const { images, client, crop } = setup();
        await images.save("cover", "data:c", AREA);
        expect(crop).toHaveBeenCalledWith("data:c", AREA, { width: 600, height: 800 });
        expect(client.setUserProfileBackground).toHaveBeenCalledWith(IMAGE.data);
    });

    test("a failed upload says so, and the old image shows again", async () => {
        const { images, release } = setup(false);
        release();
        expect(await images.save("avatar", "data:a", AREA)).toEqual({
            kind: "failed",
            reason: "avatarUpdateFailed",
        });
        expect(images.preview.avatar).toBeUndefined();
    });

    test("an image that can't be cropped fails without uploading", async () => {
        const { images, client } = setup();
        const failing = new ProfileImages(client, async () => undefined);
        expect(await failing.save("cover", "data:x", AREA)).toEqual({
            kind: "failed",
            reason: "profile.backgroundUpdateFailed",
        });
        expect(client.setUserProfileBackground).not.toHaveBeenCalled();
        expect(images.uploading.cover).toBe(false);
    });
});
