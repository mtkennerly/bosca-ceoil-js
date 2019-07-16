var ghPages = require("gh-pages");

ghPages.publish(
    ".",
    {
        "src": [
            "index.html",
            "assets/*.css",
            "assets/*.js",
            "audio/**/*.flac",
        ]
    },
    err => {
        console.log(`Failure: ${err}`);
    }
);
