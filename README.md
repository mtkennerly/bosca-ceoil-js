# Bosca Ceoil JS
This project is an HTML/CSS/JavaScript (TypeScript) rewrite of
[Bosca Ceoil](https://github.com/TerryCavanagh/boscaceoil) using samples
of the preset instruments from [SiON](https://github.com/keim/SiON)
(rather than a port of SiON itself).

It is still a prototype, so significant functionality is missing.

## Sample creation
The SiON samples were created by running
`npm run samples -- <path_to_bosca_ceoil_clone>`.
This requires a few things:

* A clone of Bosca Ceoil with support for
  [exporting via CLI](https://github.com/TerryCavanagh/boscaceoil/pull/71).
  Since that functionality is not in an official release, the script will run
  `adl application.xml` in that clone, so you'll need the Adobe AIR SDK.
* [SoX](http://sox.sourceforge.net) for removing silence from the end of the
  recordings and converting from WAV to OGG.

The script should be run with 100% system volume.

## Development
Prerequisites:

* [Node](https://nodejs.org/en)

Initial setup:

* `npm install`
* `npm run assets`

Run:

* `npm run dev`
* Open `http://127.0.0.1:8000/index.html` in your browser
