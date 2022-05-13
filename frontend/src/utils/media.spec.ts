/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    containsDsocialLink,
    containsYoutubeLink,
    dsocialRegex,
    isDsocialLink,
    isYoutubeLink,
    youtubeRegex,
} from "./media";

describe("video link transform", () => {
    describe("dsocial", () => {
        describe("isDsocialLink", () => {
            test("long form", () => {
                const txt =
                    "https://dwqte-viaaa-aaaai-qaufq-cai.ic0.app/3108-2045/luffy-vs-aokiji-english-sub";
                expect(isDsocialLink(txt)).toEqual(true);
                expect(containsDsocialLink(txt)).toEqual(false);
            });
            test("short form", () => {
                const txt = "https://dsocial.app/3108-2045";
                expect(isDsocialLink(txt)).toEqual(true);
                expect(containsDsocialLink(txt)).toEqual(false);
            });
            test("with slug", () => {
                const txt = "https://dsocial.app/3108-2045/some-video-title";
                expect(isDsocialLink(txt)).toEqual(true);
                expect(containsDsocialLink(txt)).toEqual(false);
            });
            test("no match", () => {
                const txt = "this is a nice video but no link";
                expect(isDsocialLink(txt)).toEqual(false);
                expect(containsDsocialLink(txt)).toEqual(false);
            });
            test("can extract id", () => {
                const txt = "https://dsocial.app/3108-2045/some-video-title";
                expect(txt.match(dsocialRegex())![1]).toEqual("3108-2045");
            });
        });

        describe("containsDsocialLink", () => {
            test("long form", () => {
                const txt =
                    "this is a cool video: https://dwqte-viaaa-aaaai-qaufq-cai.ic0.app/3108-2045/luffy-vs-aokiji-english-sub watch it!";
                expect(containsDsocialLink(txt)).toEqual(true);
                expect(isDsocialLink(txt)).toEqual(false);
            });
            test("prefix and suffix", () => {
                const txt = "this is a cool video: https://dsocial.app/3108-2045 please watch";
                expect(containsDsocialLink(txt)).toEqual(true);
                expect(isDsocialLink(txt)).toEqual(false);
            });
            test("suffix", () => {
                const txt = "https://dsocial.app/3108-2045 please watch it";
                expect(containsDsocialLink(txt)).toEqual(true);
                expect(isDsocialLink(txt)).toEqual(false);
            });
            test("prefix", () => {
                const txt = "this is cool https://dsocial.app/3108-2045";
                expect(containsDsocialLink(txt)).toEqual(true);
                expect(isDsocialLink(txt)).toEqual(false);
            });
            test("with slug", () => {
                const txt = "https://dsocial.app/3108-2045/some-video-title";
                expect(containsDsocialLink(txt)).toEqual(false);
                expect(isDsocialLink(txt)).toEqual(true);
            });
            test("no match", () => {
                const txt = "this is a nice video but no link";
                expect(containsDsocialLink(txt)).toEqual(false);
                expect(isDsocialLink(txt)).toEqual(false);
            });
        });
    });

    describe("youtube", () => {
        describe("extracting id", () => {
            describe("short form", () => {
                test("no prefix or suffix", () => {
                    const txt = "https://youtu.be/9n1dtmzqnCU";
                    expect(txt.match(youtubeRegex())![2]).toEqual("9n1dtmzqnCU");
                });
                test("with a prefix", () => {
                    const txt = "look at this link: https://youtu.be/9n1dtmzqnCU";
                    expect(txt.match(youtubeRegex())![2]).toEqual("9n1dtmzqnCU");
                });
                test("with a suffix", () => {
                    const txt = "https://youtu.be/9n1dtmzqnCU look at this link";
                    expect(txt.match(youtubeRegex())![2]).toEqual("9n1dtmzqnCU");
                });
                test("with a suffix and a prefix", () => {
                    const txt = "look at this link https://youtu.be/9n1dtmzqnCU look at this link";
                    expect(txt.match(youtubeRegex())![2]).toEqual("9n1dtmzqnCU");
                });
            });

            describe("long form", () => {
                test("no prefix or suffix", () => {
                    const txt = "https://www.youtube.com/watch?v=9n1dtmzqnCU";
                    expect(txt.match(youtubeRegex())![1]).toEqual("9n1dtmzqnCU");
                });
                test("with appended linebreaks", () => {
                    const txt = "https://www.youtube.com/watch?v=u8LMyWcKL_c\n\n\n\nThis dev";
                    expect(txt.match(youtubeRegex())![1]).toEqual("u8LMyWcKL_c");
                });
                test("with preceeding linebreaks", () => {
                    const txt =
                        "Look at this link\n\n\nhttps://www.youtube.com/watch?v=u8LMyWcKL_c";
                    expect(txt.match(youtubeRegex())![1]).toEqual("u8LMyWcKL_c");
                });
                test("with a prefix", () => {
                    const txt = "look at this link https://www.youtube.com/watch?v=9n1dtmzqnCU";
                    expect(txt.match(youtubeRegex())![1]).toEqual("9n1dtmzqnCU");
                });
                test("with a suffix", () => {
                    const txt = "https://www.youtube.com/watch?v=9n1dtmzqnCU look at this link";
                    expect(txt.match(youtubeRegex())![1]).toEqual("9n1dtmzqnCU");
                });
                test("with a suffix and a prefix", () => {
                    const txt =
                        "look at this link https://www.youtube.com/watch?v=9n1dtmzqnCU look at this link";
                    expect(txt.match(youtubeRegex())![1]).toEqual("9n1dtmzqnCU");
                });
            });
        });
        describe("isYoutubeLink", () => {
            test("long form", () => {
                const txt = "https://www.youtube.com/watch?v=9n1dtmzqnCU";
                expect(isYoutubeLink(txt)).toEqual(true);
                expect(containsYoutubeLink(txt)).toEqual(false);
            });
            test("short form", () => {
                const txt = "https://youtu.be/9n1dtmzqnCU";
                expect(isYoutubeLink(txt)).toEqual(true);
                expect(containsYoutubeLink(txt)).toEqual(false);
            });
            test("no match", () => {
                expect(isYoutubeLink("this is a nice video but no link")).toEqual(false);
            });
        });
        describe("containsYoutubeLink", () => {
            test("long form", () => {
                const txt =
                    "this is a cool video https://www.youtube.com/watch?v=9n1dtmzqnCU watch it!";
                expect(containsYoutubeLink(txt)).toEqual(true);
                expect(isYoutubeLink(txt)).toEqual(false);
            });
            test("prefix and suffix", () => {
                const txt = "this is a cool video https://youtu.be/9n1dtmzqnCU watch it!";
                expect(containsYoutubeLink(txt)).toEqual(true);
                expect(isYoutubeLink(txt)).toEqual(false);
            });
            test("prefix", () => {
                const txt = "this is a cool video https://youtu.be/9n1dtmzqnCU";
                expect(containsYoutubeLink(txt)).toEqual(true);
                expect(isYoutubeLink(txt)).toEqual(false);
            });
            test("suffix", () => {
                const txt = "video https://youtu.be/9n1dtmzqnCU watch it!";
                expect(containsYoutubeLink(txt)).toEqual(true);
                expect(isYoutubeLink(txt)).toEqual(false);
            });
            test("no match", () => {
                expect(containsYoutubeLink("this is a nice video but no link")).toEqual(false);
                expect(isYoutubeLink("this is a nice video but no link")).toEqual(false);
            });
        });
    });
});
