import * as tone from 'tone';
import { changeSampler, getSampler } from "./audio";
const dialogPolyfill = require("dialog-polyfill");

let playing = false;
const letters = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const chords = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const volume = new tone.Volume(0);
const lowPass = new tone.LowpassCombFilter(0, 0);

const delayEffect = new tone.FeedbackDelay(0, 0);
const chorusEffect = new tone.Chorus();
chorusEffect.wet.value = 0;
const reverbEffect = new tone.Freeverb(0, 3000);
reverbEffect.wet.value = 0;
const distortionEffect = new tone.BitCrusher(4);
distortionEffect.wet.value = 0;
const lowBoostEffect = new tone.Filter(0, "lowshelf");
const compressorEffect = new tone.Compressor(0);
const highPassEffect = new tone.Filter(0, "highpass");

interface Note {
    length: number;
    scheduledEvent: number | null;
}

let instrumentName = "midi.piano1";
let sampler = getSampler("midi.piano1");
let patterns: { [key: number]: { [key: string]: Array<Note> } } = {};
for (const chord of chords) {
    patterns[chord] = {};
    for (const letter of letters) {
        patterns[chord][letter] = Array.from({ length: 16 }, () => { return { length: 0, scheduledEvent: null }; });
    }
}

function toggleAudio() {
    if (playing) {
        tone.Transport.stop();
        tone.Transport.position = "0";
    } else {
        resumeAudioContext();
        tone.Transport.loopEnd = '1m';
        tone.Transport.loop = true;
    }
    tone.Transport.toggle(0);
    playing = !playing;
}

function resumeAudioContext() {
    let ac = (tone as any).context;
    if (ac.state !== "running") {
        ac.resume();
    }
}

// mdl-selectfield doesn't play nice with custom onchange event listeners,
// so we use this to handle instrument changes instead.
function setInstrumentLoop(instrumentField: HTMLSelectElement) {
    setInstrument(instrumentField);
    setTimeout(() => { setInstrumentLoop(instrumentField); }, 250);
}

function setInstrument(instrumentField: HTMLSelectElement) {
    if (instrumentName !== instrumentField.value) {
        instrumentName = instrumentField.value;
        changeSampler(sampler, instrumentField.value);
    }
}

function setBpm() {
    let bpmField = document.getElementById("bpm");
    if (bpmField !== null && bpmField instanceof HTMLInputElement) {
        tone.Transport.bpm.value = parseInt(bpmField.value);
    }
}

function setVolume() {
    const field = document.getElementById("volume");
    if (field !== null && field instanceof HTMLInputElement) {
        let newValue = parseInt(field.value);
        if (newValue === 0) {
            volume.mute = true;
        } else {
            volume.volume.value = (newValue - 100) / 5;
            volume.mute = false;
        }
    }
}

function setSwing() {
    const field = document.getElementById("swing");
    if (field !== null && field instanceof HTMLInputElement) {
        tone.Transport.swing = parseFloat(field.value);
        tone.Transport.swingSubdivision = "16n";
    }
}

function setResonance() {
    const field = document.getElementById("resonance");
    if (field !== null && field instanceof HTMLInputElement) {
        lowPass.resonance.value = parseFloat(field.value);
    }
}

function setDampening() {
    const field = document.getElementById("dampening");
    if (field !== null && field instanceof HTMLInputElement) {
        lowPass.dampening.value = parseInt(field.value);
    }
}

function togglePlayButton() {
    let playButton = document.getElementById("playButton");
    if (playButton !== null) {
        if (playButton.textContent !== null && playButton.textContent.trim().toLowerCase() === "play") {
            playButton.textContent = "Stop";
        } else {
            playButton.textContent = "Play";
        }
    }
}

function setEffect(effect: string, value: number) {
    switch (effect) {
        case "delay":
            delayEffect.delayTime.value = value === 0 ? 0 : tone.Time("8n") * 2 * value;
            delayEffect.feedback.value = 0.15 * 2 * value;
            break;
        case "chorus":
            chorusEffect.wet.value = value;
            break;
        case "reverb":
            reverbEffect.roomSize.value = value * 0.9;
            reverbEffect.wet.value = value;
            break;
        case "distortion":
            distortionEffect.wet.value = value === 0 ? 0 : 1;
            distortionEffect.bits = value;
            break;
        case "lowBoost":
            lowBoostEffect.frequency.value = value;
            lowBoostEffect.gain.value = value === 0 ? 0 : 20;
            break;
        case "compressor":
            compressorEffect.threshold.value = value;
            break;
        case "highPass":
            highPassEffect.frequency.value = value;
            break;
    }
}

function scheduleNote(chord: number, letter: string, index: number, length: number) {
    unscheduleNote(chord, letter, index);
    // console.log(`scheduleNote(chord=${chord}, letter=${letter}, index=${index}, length=${length})`);
    patterns[chord][letter][index]["length"] = length;

    patterns[chord][letter][index]["scheduledEvent"] = tone.Transport.schedule(
        time => {
            sampler.triggerAttackRelease(`${letter}${chord}`, tone.Time("16n") * length, time);
            tone.Draw.schedule(() => {
                const noteElement = document.querySelector(`#${letter.replace("#", "\\#")}-${chord}-${index}`);
                if (noteElement !== null) {
                    if (length <= 1) {
                        noteElement.classList.add("playing");
                    } else {
                        noteElement.classList.add("playingLong");
                    }
                    setTimeout(() => {
                        noteElement.classList.remove("playing");
                        noteElement.classList.remove("playingLong");
                    }, 100 * length);
                }
            }, time);
        },
        `0:0:${index}`
    );
}

function unscheduleNote(chord: number, letter: string, index: number) {
    patterns[chord][letter][index]["length"] = 0;
    const schedulee = patterns[chord][letter][index]["scheduledEvent"];
    if (schedulee !== null) {
        tone.Transport.clear(schedulee);
        patterns[chord][letter][index]["scheduledEvent"] = null;
    }
}

function onClickNoteCell(event: MouseEvent, cell: HTMLTableCellElement, chord: number, letter: string, index: number) {
    let length = patterns[chord][letter][index]["length"];
    // console.log(`onClickNoteCell(chord=${chord}, letter=${letter}, index=${index}) | length ${length}`);

    if (event.shiftKey && event.ctrlKey) {
        length = Math.max(length - 1, 0);
    } else if (event.shiftKey) {
        length = Math.max(Math.min(length + 1, 16), 2);
    } else if (length > 0) {
        length = 0;
    } else {
        length = 1;
    }

    cell.innerHTML = length.toString();

    if (length <= 1) {
        cell.classList.remove("noteLong");
    } else {
        cell.classList.add("noteLong");
    }

    if (length > 0 && length !== patterns[chord][letter][index]["length"]) {
        cell.classList.add("active");
        scheduleNote(chord, letter, index, length);
    } else if (length === 0) {
        cell.classList.remove("active");
        unscheduleNote(chord, letter, index);
    }
}

function onLoad() {
    sampler.chain(
        volume,
        lowPass,
        delayEffect,
        chorusEffect,
        reverbEffect,
        distortionEffect,
        lowBoostEffect,
        compressorEffect,
        highPassEffect,
        tone.Master
    );

    document.onkeypress = event => {
        if (event.keyCode === 32) {
            toggleAudio();
            togglePlayButton();
            return false;
        }
    };

    let playButton = document.getElementById("playButton");
    if (playButton !== null) {
        playButton.addEventListener("click", toggleAudio);
        playButton.addEventListener("click", togglePlayButton);
    }

    let helpButton = document.getElementById("helpButton");
    let helpModal = document.getElementById("helpModal");
    if (helpButton !== null && helpModal !== null) {
        if (!(helpModal as any).showModal) {
            dialogPolyfill.default.registerDialog(helpModal);
        }
        helpButton.addEventListener("click", () => { (helpModal as any).showModal(); });
        const helpModalClose = helpModal.querySelector(".close");
        if (helpModalClose !== null) {
            helpModalClose.addEventListener("click", () => {
                (helpModal as any).close();
            });
        }
    }

    let instrumentField = document.getElementById("instruments");
    if (instrumentField !== null && instrumentField instanceof HTMLSelectElement) {
        setInstrumentLoop(instrumentField);
    }

    let bpmField = document.getElementById("bpm");
    if (bpmField !== null) {
        bpmField.addEventListener("change", setBpm);
    }

    let effectsMenu = document.getElementById("effectsMenu");
    if (effectsMenu !== null) {
        effectsMenu.addEventListener("click", event => {
            event.stopPropagation();
        });
    }

    const effects = ["delay", "chorus", "reverb", "distortion", "lowBoost", "compressor", "highPass"];
    for (const effect of effects) {
        const effectField = document.getElementById(`${effect}Effect`);
        if (effectField !== null && effectField instanceof HTMLInputElement) {
            effectField.addEventListener("change", () => {
                setEffect(effect, parseFloat(effectField.value));
            });
        }
    }

    let patternTable = document.getElementById("pattern");
    if (patternTable !== null && patternTable instanceof HTMLTableElement) {
        for (const chord of chords.slice().reverse()) {
            let first = true;


            for (const letter of letters.slice().reverse()) {
                let row = patternTable.insertRow();
                if (first) {
                    first = false;
                    let chordHeader = document.createElement("th");
                    chordHeader.rowSpan = letters.length;
                    chordHeader.innerHTML = chord.toString();
                    row.appendChild(chordHeader);
                }

                let letterHeader = document.createElement("th");
                letterHeader.innerHTML = letter;
                row.appendChild(letterHeader);

                for (const i of Array(16).keys()) {
                    let cell = row.insertCell();
                    cell.id = `${letter}-${chord}-${i}`;
                    cell.classList.add(`note-${letter}`);
                    cell.onclick = event => { onClickNoteCell(event, cell, chord, letter, i); };
                }
            }
        }
    }

    const centralRow = document.getElementById("F-5-0");
    if (centralRow !== null) {
        centralRow.scrollIntoView({ "behavior": "smooth", "block": "center" });
    }

    let volumeField = document.getElementById("volume");
    if (volumeField !== null) {
        volumeField.addEventListener("change", setVolume);
    }

    let swingField = document.getElementById("swing");
    if (swingField !== null) {
        swingField.addEventListener("change", setSwing);
    }

    let resonanceField = document.getElementById("resonance");
    if (resonanceField !== null) {
        resonanceField.addEventListener("change", setResonance);
    }

    let dampeningField = document.getElementById("dampening");
    if (dampeningField !== null) {
        dampeningField.addEventListener("change", setDampening);
    }
}

window.onload = onLoad;
