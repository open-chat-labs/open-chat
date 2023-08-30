type LinkInfo = {
    title: string | null | undefined;
    description: string | null | undefined;
    image: string | null | undefined;
};

export function loadPreviews(links: string[]): Promise<boolean> {
    return Promise.all(links.map(loadPreview))
        .then((previews) => {
            // we actually need to wait for any images to either load or fail to load well before we can measure the height
            // window.setTimeout(() => {
            //     if (previewsWrapper) {
            //         console.log("previewsWrapper height: ", previewsWrapper.offsetHeight);
            //     }
            // }, 0);
            return previews;
        })
        .catch((_err) => {
            // let's not let any error bubble up and cause problems.
            return false;
        });
}

async function loadPreview(url: string): Promise<LinkInfo | undefined> {
    const response = await fetch(`https://proxy.cors.sh/${url}`, {
        headers: {
            "x-cors-api-key": process.env.CORS_APIKEY!,
        },
    });

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const description = doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute("content");
    const image = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");

    return {
        title,
        description,
        image,
    };
}
