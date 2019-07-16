var ghPages = require("gh-pages");

ghPages.publish(
    ".",
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
