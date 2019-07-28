import fs from "fs";
import path from "path";
import process from "process";
import child_process from "child_process";
import yaml from "js-yaml";
import { InstrumentData, notes } from "../src/index";

if (process.argv.length < 3) {
    console.error("Must specify location of Bosca Ceoil clone with CLI export functionality.");
    process.exit(1);
}

const root = `${path.dirname(process.argv[1])}/..`;
const tmp = `${root}/tmp`;
const boscaCeoilDir = process.argv[2];
const instrumentData: InstrumentData = yaml.safeLoad(fs.readFileSync(`${root}/instruments.yaml`).toString());
const song = fs.readFileSync(`${root}/audio/main.ceol`).toString().split(",");

if (!fs.existsSync(tmp)) {
    fs.mkdirSync(tmp);
}

for (const [instrument, { index }] of Object.entries(instrumentData)) {
    const instrumentDir = `${root}/audio/${instrument}`;

    if (!fs.existsSync(instrumentDir)) {
        fs.mkdirSync(instrumentDir);
    }

    for (const note of notes) {
        if (fs.existsSync(`${instrumentDir}/${note.toLowerCase()}.ogg`)) {
            continue;
        }

        if (!fs.existsSync(`${tmp}/${instrument}-${note.toLowerCase()}.wav`)) {
            song[8] = index.toString();
            song[20] = (0 + 12 * notes.indexOf(note)).toString();
            fs.writeFileSync(`${tmp}/${instrument}.ceol`, song.join(","));

            console.log(`${instrument}: ${note}`);

            child_process.execSync(
                `adl application.xml -- ${tmp}/main.ceol --export ${tmp}/${instrument}-${note.toLowerCase()}.wav`,
                { cwd: boscaCeoilDir },
            );
        }

        child_process.execSync(
            `sox ${tmp}/${instrument}-${note.toLowerCase()}.wav -C 5 ${instrumentDir}/${note.toLowerCase()}.ogg silence 0 1 0.1 0.1%`,
            { cwd: root },
        );

        fs.unlinkSync(`${tmp}/${instrument}-${note.toLowerCase()}.wav`);
    }
}

if (fs.existsSync(`${tmp}/main.ceol`)) {
    fs.unlinkSync(`${tmp}/main.ceol`);
}
