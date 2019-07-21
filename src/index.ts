export function assertNever(x: never): never {
    throw new Error(`Unexhaustive condition leading to value: ${x}`);
}

// Durations:
// - Constant means that the sound plays for the same amount of time
//   regardless of the length of the note in Bosca Ceoil.
// - Infinite means that the sound plays for however arbitrarily long
//   the Bosca Ceoil note is.
// - The others are finite times, meaning that the sound will play up to
//   a max time, but after that point, it will go silent regardless of how
//   long the note is in Bosca Ceoil.
export interface Instrument {
    index: number;
    duration: "instant" | "mini" | "short" | "mid" | "long" | "extended" | "mega" | "constant" | "infinite";
    release: number;
    category: Array<string>;
}

export type InstrumentData = { [key: string]: Instrument };

export const notes = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"];
