require("@material/react-button/dist/button.css");
require("@material/react-select/dist/select.css");
require("@material/react-text-field/dist/text-field.css");
require("@material/react-menu-surface/dist/menu-surface.css");
require("@material/react-dialog/dist/dialog.css");

import { store, view } from "react-easy-state";
import tone from "tone";

import React from "react";
import ReactDom from "react-dom";
import Button from "@material/react-button";
import Select, { Option } from "@material/react-select";
import TextField, { Input } from "@material/react-text-field";
import MenuSurface, { Corner } from "@material/react-menu-surface";
import Dialog, { DialogTitle, DialogContent, DialogFooter, DialogButton } from "@material/react-dialog";

import { changeSampler, getSampler } from "./audio";
import { instrumentData } from "./data";
import { assertNever } from "./index";

let playing = false;
const letters = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const chords = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function fromMaybes<T>(maybes: Array<T | null | undefined>, fallback: T) {
    for (const value of maybes) {
        if (value !== null && value !== undefined) {
            return value;
        }
    }
    return fallback;
}

class Song {
    meta: SongMeta = new SongMeta();
    effects: Effects = new Effects();
    patterns: Array<Pattern> = [new Pattern()];
    channels: Array<Channel> = [new Channel()];
    playing: boolean = false;

    toggleAudio(): void {
        if (this.playing) {
            tone.Transport.stop();
            tone.Transport.position = "0";
        } else {
            resumeAudioContext();
            tone.Transport.loopEnd = "1m";
            tone.Transport.loop = true;
        }
        tone.Transport.toggle(0);
        this.playing = !this.playing;
    }

    getEffect(effect: keyof Effects, channel: number, pattern: number): number {
        return fromMaybes(
            [
                this.patterns[pattern].effects[effect],
                this.channels[channel].effects[effect],
            ],
            this.effects[effect]
        );
    }

    getEffectBy(effect: keyof Effects, level: "song" | "channel" | "pattern", index: number = 0) {
        switch (level) {
            case "song":
                return this.effects[effect];
            case "channel":
                return this.channels[index].effects[effect];
            case "pattern":
                return this.patterns[index].effects[effect];
        }
    }

    setEffectBy(effect: keyof Effects, value: number | undefined, level: "song" | "channel" | "pattern", index: number = 0) {
        switch (level) {
            case "song":
                if (value === undefined) {
                    throw new Error("Song-level effects cannot be undefined");
                }
                this.effects[effect] = value;
                for (let channel = 0; channel < this.channels.length; channel++) {
                    for (const pattern of this.channels[channel].patterns) {
                        if (pattern !== null) {
                            this.patterns[pattern].pipeline.setEffect(effect, this.getEffect(effect, channel, pattern));
                        }
                    }
                }
                break;
            case "channel":
                this.channels[index].effects[effect] = value;
                for (const pattern of this.channels[index].patterns) {
                    if (pattern !== null) {
                        this.patterns[pattern].pipeline.setEffect(effect, this.getEffect(effect, index, pattern));
                    }
                }
                break;
            case "pattern":
                this.patterns[index].effects[effect] = value;
                for (let channel = 0; channel < this.channels.length; channel++) {
                    for (const pattern of this.channels[channel].patterns) {
                        if (pattern === index) {
                            this.patterns[pattern].pipeline.setEffect(effect, this.getEffect(effect, channel, index));
                        }
                    }
                }
                break;
        }
    }

    setInstrument(value: string, pattern: number): void {
        this.patterns[pattern].instrument = value;
        changeSampler(this.patterns[pattern].pipeline.sampler, value);
    }

    setBpm(value: number): void {
        this.meta.bpm = value;
        tone.Transport.bpm.value = song.meta.bpm;
    }

    setSwing(value: number): void {
        this.meta.swing = value;
        tone.Transport.swing = song.meta.swing;
        tone.Transport.swingSubdivision = "16n";
    }

    scheduleNote(channel: number, pattern: number, chord: number, letter: string, index: number, length: number, noteCell: NoteCell) {
        this.unscheduleNote(channel, pattern, chord, letter, index);
        // console.log(`Song.scheduleNote(chord=${chord}, letter=${letter}, index=${index}, length=${length})`);
        this.patterns[pattern].notes[chord][letter][index].length = length;

        this.patterns[pattern].notes[chord][letter][index].scheduledEvent = tone.Transport.schedule(
            time => {
                this.patterns[pattern].pipeline.sampler.triggerAttackRelease(
                    `${letter}${chord}`, tone.Time("16n") * length, time
                );
                tone.Draw.schedule(() => {
                    noteCell.setState({ playing: true });
                    setTimeout(() => {
                        noteCell.setState({ playing: false });
                    }, 100 * length);
                }, time);
            },
            `0:0:${index}`
        );
    }

    unscheduleNote(channel: number, pattern: number, chord: number, letter: string, index: number) {
        // console.log(`Song.unscheduleNote(chord=${chord}, letter=${letter}, index=${index}, length=${length})`);
        this.patterns[pattern].notes[chord][letter][index].length = 0;
        const schedulee = this.patterns[pattern].notes[chord][letter][index].scheduledEvent;
        if (schedulee !== null) {
            tone.Transport.clear(schedulee);
            this.patterns[pattern].notes[chord][letter][index].scheduledEvent = null;
        }
    }
}

class SongMeta {
    bpm: number = 120;
    swing: number = 0;
}

class Effects {
    volume: number = 100;
    resonance: number = 0;
    dampening: number = 0;
    delay: number = 0;
    chorus: number = 0;
    reverb: number = 0;
    distortion: number = 0;
    lowBoost: number = 0;
    compressor: number = 0;
    highPass: number = 0;
}

class Pipeline {
    sampler: tone.Sampler;
    volume = new tone.Volume(0);
    lowPass = new tone.LowpassCombFilter(0, 0);
    delayEffect = new tone.FeedbackDelay(0, 0);
    chorusEffect = new tone.Chorus();
    reverbEffect = new tone.Freeverb(0, 3000);
    distortionEffect = new tone.BitCrusher(4);
    lowBoostEffect = new tone.Filter(0, "lowshelf");
    compressorEffect = new tone.Compressor(0);
    highPassEffect = new tone.Filter(0, "highpass");

    constructor(instrument: string = "midi.piano1") {
        this.sampler = getSampler(instrument);
        this.chorusEffect.wet.value = 0;
        this.reverbEffect.wet.value = 0;
        this.distortionEffect.wet.value = 0;

        this.sampler.chain(
            this.volume,
            this.lowPass,
            this.delayEffect,
            this.chorusEffect,
            this.reverbEffect,
            this.distortionEffect,
            this.lowBoostEffect,
            this.compressorEffect,
            this.highPassEffect,
            tone.Master,
        );
    }

    setEffect(effect: keyof Effects, value: number): void {
        switch (effect) {
            case "volume":
                if (value === 0) {
                    this.volume.mute = true;
                } else {
                    this.volume.volume.value = (value - 100) / 5;
                    this.volume.mute = false;
                }
                break;
            case "resonance":
                this.lowPass.resonance.value = value;
                break;
            case "dampening":
                this.lowPass.dampening.value = value;
                break;
            case "delay":
                this.delayEffect.delayTime.value = value === 0 ? 0 : tone.Time("8n") * 2 * value;
                this.delayEffect.feedback.value = 0.15 * 2 * value;
                break;
            case "chorus":
                this.chorusEffect.wet.value = value;
                break;
            case "reverb":
                this.reverbEffect.roomSize.value = value * 0.9;
                this.reverbEffect.wet.value = value;
                break;
            case "distortion":
                this.distortionEffect.wet.value = value === 0 ? 0 : 1;
                this.distortionEffect.bits = value;
                break;
            case "lowBoost":
                this.lowBoostEffect.frequency.value = value;
                this.lowBoostEffect.gain.value = value === 0 ? 0 : 20;
                break;
            case "compressor":
                this.compressorEffect.threshold.value = value;
                break;
            case "highPass":
                this.highPassEffect.frequency.value = value;
                break;
            default:
                assertNever(effect);
        }
    }
}

class Pattern {
    effects: Partial<Effects> = {};
    notes: { [key: number]: { [key: string]: Array<Note> } } = {};
    pipeline: Pipeline;

    constructor(public instrument: string = "midi.piano1") {
        this.pipeline = new Pipeline(this.instrument);
        for (const chord of chords) {
            this.notes[chord] = {};
            for (const letter of letters) {
                this.notes[chord][letter] = Array.from({ length: 16 }, () => ({ length: 0, scheduledEvent: null }));
            }
        }
    }
}

class Channel {
    effects: Partial<Effects> = {};
    patterns: Array<number | null>;

    constructor(patterns: Array<number | null> = [0]) {
        this.patterns = patterns;
    }
}

const song: Song = store(new Song());

@view
class EffectChoice extends React.Component<{
    effect: keyof Effects,
    mode: "song" | "channel" | "pattern",
    modeIndex: number,
    min: number,
    max: number,
    step: number,
}> {
    getLabel(): string {
        switch (this.props.effect) {
            case "chorus":
                return "Chorus";
            case "compressor":
                return "Compressor";
            case "dampening":
                return "Dampening";
            case "delay":
                return "Delay";
            case "distortion":
                return "Distortion";
            case "highPass":
                return "High pass";
            case "lowBoost":
                return "Low boost";
            case "resonance":
                return "Resonance";
            case "reverb":
                return "Reverb";
            case "volume":
                return "Volume";
            default:
                return assertNever(this.props.effect);
        }
    }
    render(): React.ReactNode {
        return <TextField label={this.getLabel()}>
            <Input
                required={this.props.mode === "song"}
                type="number"
                min={this.props.min}
                max={this.props.max}
                step={this.props.step}
                value={song.getEffectBy(this.props.effect, this.props.mode, this.props.modeIndex)}
                // @ts-ignore
                onChange={e => {
                    if (this.props.mode !== "song" && e.currentTarget.value === "") {
                        song.setEffectBy(this.props.effect, undefined, this.props.mode, this.props.modeIndex);
                        return;
                    }
                    const newValue = parseFloat(e.currentTarget.value);
                    if (!isNaN(newValue)) {
                        song.setEffectBy(this.props.effect, newValue, this.props.mode, this.props.modeIndex);
                    } else if (e.currentTarget.value === undefined && this.props.mode !== "song") {
                        song.setEffectBy(this.props.effect, undefined, this.props.mode, this.props.modeIndex);
                    }
                }}
            />
        </TextField>;
    }
}

@view
class EffectPanel extends React.Component<{
    mode: "song" | "channel" | "pattern",
    modeIndex: number,
}> {
    state = {
        open: false,
        anchorElement: undefined,
    };

    getButtonText(): string {
        switch (this.props.mode) {
            case "song":
                return "Song";
            case "channel":
                return "Channel";
            case "pattern":
                return "Pattern"
            default:
                return assertNever(this.props.mode);
        }
    }

    setAnchorElement = (element: HTMLDivElement) => {
        if (this.state.anchorElement) {
            return;
        }
        this.setState({ anchorElement: element });
    }

    render() {
        return (
            <div
                className="mdc-menu-surface--anchor effect-panel"
                ref={this.setAnchorElement}
            >
                <Button raised onClick={() => this.setState({ open: true })}>{this.getButtonText()}</Button>

                <MenuSurface
                    open={this.state.open}
                    anchorCorner={Corner.BOTTOM_LEFT}
                    onClose={() => this.setState({ open: false })}
                    anchorElement={this.state.anchorElement}
                >
                    <div className="effect-panel-popup">
                        <EffectChoice effect="volume" min={0} max={200} step={5} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="resonance" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="dampening" min={0} max={3000} step={100} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="delay" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="chorus" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="reverb" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="distortion" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="lowBoost" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="compressor" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                        <EffectChoice effect="highPass" min={0} max={1} step={0.05} mode={this.props.mode} modeIndex={this.props.modeIndex} />
                    </div>
                </MenuSurface>
            </div>
        );
    }
}

@view
class PlayButton extends React.Component {
    onClick() {
        song.toggleAudio();
    }
    render(): React.ReactNode {
        return <Button id="playButton" onClick={() => this.onClick()} raised>
            {song.playing ? "Stop" : "Play"}
        </Button>;
    }
}

@view
class Help extends React.Component {
    state = {
        displayed: false,
    };
    render(): React.ReactNode {
        return <a>
            <Button id="helpButton" onClick={() => this.setState({displayed: true})} raised>Help</Button>
            <Dialog open={this.state.displayed} onClose={() => this.setState({displayed: false})}>
                <DialogTitle>Help</DialogTitle>
                <DialogContent>
                    <div>
                        <ul>
                            <li>Click in a box to add or remove a note.</li>
                            <li>Shift click to extend a note, and ctrl-shift click to shorten it.</li>
                            <li>Press the space bar to play or stop the song.</li>
                            <li>After clicking in an entry field, use the arrow keys to quickly change the value.</li>
                        </ul>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <DialogButton action="close" isDefault>Close</DialogButton>
                </DialogFooter>
            </Dialog>
        </a>;
    }
}

@view
class MetaWorkspace extends React.Component<{ activeChannel: number, activePattern: number }> {
    render(): React.ReactNode {
        const instruments = [];
        for (const [instrument, { category }] of Object.entries(instrumentData)) {
            instruments.push(
                <Option key={instrument} value={instrument}>{category.join(" > ")}</Option>
            );
        }

        return <div id="metaWorkspace">
            <PlayButton />
            <Select
                label="Pattern instrument"
                value={song.patterns[this.props.activePattern].instrument}
                onChange={e => {
                    song.setInstrument(e.currentTarget.value, this.props.activeChannel);
                }}
            >
                {instruments}
            </Select>
            <TextField label="BPM">
                <Input
                    required
                    type="number"
                    min={10}
                    max={220}
                    step={5}
                    value={song.meta.bpm}
                    // @ts-ignore
                    onChange={e => {
                        const value = parseInt(e.currentTarget.value);
                        if (isNaN(value)) {
                            return;
                        }
                        song.setBpm(value);
                    }}
                />
            </TextField>
            <TextField label="Swing">
                <Input
                    required
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={song.meta.swing}
                    // @ts-ignore
                    onChange={e => {
                        const value = parseFloat(e.currentTarget.value);
                        if (isNaN(value)) {
                            return;
                        }
                        song.setSwing(value);
                    }}
                />
            </TextField>
            <EffectPanel mode="song" modeIndex={0} />
            <EffectPanel mode="channel" modeIndex={0} />
            <EffectPanel mode="pattern" modeIndex={0} />
            <Help />
        </div>;
    }
}

@view
class NoteCell extends React.Component<{ channel: number, pattern: number, chord: number, letter: string, index: number }> {
    state = {
        chord: this.props.chord,
        letter: this.props.letter,
        index: this.props.index,
        length: 0,
        playing: false,
    };

    onClick(chord: number, letter: string, index: number, withShift: boolean, withCtrl: boolean) {
        let length = this.state.length;

        if (withShift && withCtrl) {
            length = Math.max(length - 1, 0);
        } else if (withShift) {
            length = Math.max(Math.min(length + 1, 16), 2);
        } else if (length > 0) {
            length = 0;
        } else {
            length = 1;
        }

        if (length > 0 && length !== this.state.length) {
            song.scheduleNote(this.props.channel, this.props.pattern, chord, letter, index, length, this);
        } else if (length === 0) {
            song.unscheduleNote(this.props.channel, this.props.pattern, chord, letter, index);
        }

        this.setState({ length: length });
    }

    render(): React.ReactNode {
        const classes = [`note-${this.state.letter}`];
        if (this.state.length > 0) {
            classes.push("active");
        }
        if (this.state.length > 1) {
            classes.push("noteLong");
        }
        if (this.state.playing) {
            if (this.state.length > 1) {
                classes.push("playingLong");
            } else {
                classes.push("playing");
            }
        }

        return <td
            id={`${this.state.letter}-${this.state.chord}-${this.state.index}`}
            className={classes.join(" ")}
            onClick={event => {
                this.onClick(this.state.chord, this.state.letter, this.state.index, event.shiftKey, event.ctrlKey);
            }}
        >
            {this.state.length === 0 ? "" : this.state.length}
        </td>;
    }
}

@view
class PatternWorkspace extends React.Component<{ channel: number, pattern: number }> {
    render(): React.ReactNode {
        let rows = [];
        for (const chord of chords.slice().reverse()) {
            let first = true;
            for (const letter of letters.slice().reverse()) {
                let items = [];
                if (first) {
                    first = false;
                    items.push(<th key={`chordHeader-${chord}`} rowSpan={letters.length}>{chord}</th>);
                }

                items.push(<th key={`letterHeader-${chord}-${letter}`}>{letter}</th>);

                for (const i of Array(16).keys()) {
                    items.push(
                        <NoteCell
                            key={`cell-${chord}-${letter}-${i}`}
                            channel={this.props.channel}
                            pattern={this.props.pattern}
                            chord={chord}
                            letter={letter}
                            index={i}
                        />
                    );
                }
                rows.push(<tr key={`row-${chord}-${letter}`}>{items}</tr>);
            }
        }

        return <div id="patternWorkspace" className="no-select">
            <table id="pattern"><tbody>{rows}</tbody></table>
        </div>;
    }
}

@view
class App extends React.Component {
    state = {
        activeChannel: 0,
        activePattern: 0,
    };
    samplers: { [key: number]: tone.Sampler } = {};
    render(): React.ReactNode {
        return <div id="app">
            <MetaWorkspace activeChannel={this.state.activeChannel} activePattern={this.state.activePattern} />
            <PatternWorkspace channel={this.state.activeChannel} pattern={this.state.activePattern} />
        </div>;
    }
}

interface Note {
    length: number;
    scheduledEvent: number | null;
}

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
        tone.Transport.loopEnd = "1m";
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

function onLoad() {
    ReactDom.render(<App />, document.querySelector("#root"));

    document.onkeypress = event => {
        if (event.keyCode === 32) {
            song.toggleAudio();
            event.stopPropagation();
            event.preventDefault();
        }
    };

    const centralRow = document.getElementById("F-5-0");
    if (centralRow !== null) {
        centralRow.scrollIntoView({ "behavior": "smooth", "block": "center" });
    }
}

window.onload = onLoad;
