import * as tone from "tone";
import { assertNever, notes } from "./index";
import { instrumentData } from "./data";

function setSamplerRelease(sampler: tone.Sampler, instrument: string) {
    const instrumentDuration = instrumentData[instrument]["duration"];

    switch (instrumentDuration) {
        case "instant":
            sampler.release = 0.05;
            break;
        case "mini":
            sampler.release = 0.125;
            break;
        case "short":
            sampler.release = 0.25;
            break;
        case "mid":
            sampler.release = 0.4;
            break;
        case "long":
            sampler.release = 1;
            break;
        case "extended":
            sampler.release = 1.5;
            break;
        case "mega":
            sampler.release = 5;
            break;
        case "constant":
            sampler.release = 30;
            break;
        case "infinite":
            sampler.release = 0.1;
            break;
        default:
            assertNever(instrumentDuration);
    }
}

function setSamplerCurve(sampler: tone.Sampler) {
    (sampler as any).curve = "linear";
}

export function getSampler(
    instrument: string,
    extension: string = "ogg",
    baseUrl: string = "/bosca-ceoil-js/audio/"
): tone.Sampler {
    let samples: { [key: string]: string } = {};
    for (const note of notes) {
        samples[note] = `${instrument}/${note.toLowerCase()}.${extension}`;
    }
    let sampler = new tone.Sampler(samples, undefined, baseUrl);
    setSamplerCurve(sampler);
    setSamplerRelease(sampler, instrument);
    return sampler;
}

export function changeSampler(
    sampler: tone.Sampler,
    instrument: string,
    extension: string = "ogg",
): tone.Sampler {
    for (const note of notes) {
        sampler.add(note, `${instrument}/${note.toLowerCase()}.${extension}`);
    }
    setSamplerCurve(sampler);
    setSamplerRelease(sampler, instrument);
    return sampler;
}
