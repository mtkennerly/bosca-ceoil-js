# Bosca Coeil JS
This project is an HTML/CSS/JavaScript (TypeScript) rewrite of
[Bosca Coeil](https://github.com/TerryCavanagh/boscaceoil) using samples
of the preset instruments from [SiON](https://github.com/keim/SiON)
(rather than a port of SiON itself).

It is still a prototype, so significant functionality is missing.

## Sample creation
This was how the SiON samples were recorded:

* 100% system volume.
* Create a Bosca Coeil song with 18 patterns, where every even pattern
  is blank. Every odd pattern is a single, full-measure note, starting
  from C1 and going up to C9.
* Record the song in Audacity and use the Sound Finder function to split
  the song into one segment per note, with these settings:
  * Silence threshold (-dB): `70.0`
  * Minimum silence duration( seconds): `0.300`
  * Label starting point: `0.010`
  * Label ending point: `0.010`
  * Add label at the end: `0` (no)
* Export all segments as FLAC at level 5 and 16-bit depth.

## Development
Prerequisites:

* [Node](https://nodejs.org/en)

Initial setup:

* `npm install`
* `npm run assets`

Run:

* `npm run dev`
* Open `http://127.0.0.1:8080/index.html` in your browser
