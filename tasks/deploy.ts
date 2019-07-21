import * as ghPages from "gh-pages";
import * as path from "path";

const root = `${path.dirname(process.argv[1])}/..`;

ghPages.publish(
    root,
    {
        "src": [
            "index.html",
            "index.css",
            "assets/*.css",
            "assets/*.js",
            "audio/**/*.flac",
        ]
    },
    err => {
        if (err !== undefined) {
            console.log(`Failure: ${err}`);
        }
    }
);
