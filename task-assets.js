var http = require("http");
var https = require("https");
var fs = require("fs");
var assets = './assets';

function download(filename, url) {
    var file = fs.createWriteStream(filename);
    var protocol = url.startsWith("https://") ? https : http;
    protocol.get(url, response => {
        response.pipe(file);
    });
}

if (!fs.existsSync(assets)) {
    fs.mkdirSync(assets);
}
download(
    `${assets}/md-icons.css`,
    "https://fonts.googleapis.com/icon?family=Material+Icons"
);
download(
    `${assets}/material.indigo-pink.min.css`,
    "https://code.getmdl.io/1.3.0/material.indigo-pink.min.css"
);
download(
    `${assets}/material.min.js`,
    "https://code.getmdl.io/1.3.0/material.min.js"
);
download(
    `${assets}/mdl-selectfield.min.css`,
    "https://cdn.rawgit.com/kybarg/mdl-selectfield/mdl-menu-implementation/mdl-selectfield.min.css"
);
download(
    `${assets}/mdl-selectfield.min.js`,
    "https://cdn.rawgit.com/kybarg/mdl-selectfield/mdl-menu-implementation/mdl-selectfield.min.js"
);
