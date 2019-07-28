import ghPages from "gh-pages";
import path from "path";

const root = `${path.dirname(process.argv[1])}/..`;

ghPages.publish(
    root,
    {
        "src": [
            "index.html",
            "public/*.css",
            "public/*.js",
            "audio/**/*.ogg",
        ]
    },
    err => {
        if (err !== undefined) {
            console.log(`Failure: ${err}`);
        }
    }
);
