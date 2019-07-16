import * as tone from 'tone';

const notes = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];

export function getSampler(instrument: string, extension: string = "flac", baseUrl: string = "audio/"): tone.Sampler {
    let samples: { [key: string]: string } = {};
    for (const note of notes) {
        samples[note] = `${instrument}/${note.toLowerCase()}.${extension}`;
    }
    let sampler = new tone.Sampler(samples, undefined, baseUrl);
    (sampler as any).curve = "linear";
    return sampler;
}
