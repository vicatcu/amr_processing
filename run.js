const fs = require('fs');
const path = require('path');

const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify/lib/sync');
const argv = require('minimist')(process.argv.slice(2));
const zeroFill = require('zero-fill');

const lab_name = argv.lab || 'NY - Cornell University Animal Health Diagnostic Center';
const combined_output_headers = (argv.combined_output_headers || 'Laboratory Name,Unique Specimen ID,State of Animal Origin,Animal Species,Reason for submission,Program Name,Specimen/ source tissue,Bacterial Organism Isolated,Salmonella Serotype,Final Diagnosis,Date of Isolation,Date Tested').split(",");
const include_header_name = argv.include_header || 'Include';
const input_data_folder = argv.folder || 'C:\\Users\\msp13\\Desktop\\AMRMasterList';
const combined_isolates_filename = argv.combined || `Missy's Master Spreadsheet.csv`;
const sensititre_filename = argv.sensititre || `SWINExportFile.TXT`;

// for name generation
const state = argv.state || 'NY';
const zipcode = argv.zip || '14853'
const unique_name_prefix = `${state}${zipcode}PPY1`;

const combined_isolates_csv = fs.readFileSync(path.join(input_data_folder, combined_isolates_filename), 'utf8');
const sensititre_csv = fs.readFileSync(path.join(input_data_folder, sensititre_filename), 'utf16le').replace(/[\t]+/, '\t'); // remove consecutive delimieters

// pre-process combined isolates data
let combined_isolates_data = parse(combined_isolates_csv, {columns: true})
let starting_number = combined_isolates_data.map(r => r['Unique Specimen ID'].slice(-4))
    .filter(v => v.trim()) // get rid of blanks
    .reduce((t,v) => +v > t ? +v : t, -Infinity) // find the maximum value
if(starting_number === -Infinity){
    starting_number = 0;
}
starting_number++;
console.log(`starting number will be ${zeroFill(4, starting_number)}`);
combined_isolates_data = combined_isolates_data.filter(r => r.Include.toLowerCase() === 'yes');
console.log(`${combined_isolates_data.length} accessions will be included`);

// pre-process sensititre data
let sensititre_data = parse(sensititre_csv, {delimiter: '\t'})
const sensititre_violations = sensititre_data.filter(d => d.length !== 340);
if(sensititre_violations.length > 0){
    console.dir(sensititre_violations);
    console.error(`Sensitre data has ${sensititre_violations.length} rows with non-compliant column length`);
    process.exit(1);
}

let post_sensitire_data = sensititre_data.map(r => {
    let date_value = r[39]; 
    let well_data = r.slice(40);
    let consolidated_well_data = [];
    // there are 100 wells worth of data, 3 columns per well
    for(let i = 0; i < 100; i++){
        const base = i * 3;
        const a = well_data[base].trim(), b = well_data[base+1].trim(), c = well_data[base+2].trim();
        if(a || b || c){
            consolidated_well_data = consolidated_well_data.concat([a,b,c]);
        }

    }
    return [date_value].concat(consolidated_well_data);
});

console.log(post_sensitire_data[0]);
console.log(post_sensitire_data[1]);

let allOutputDataRows = combined_isolates_data.map(r => {
    const accession_number =  r['Accession #'];
    let row = combined_output_headers.map(h => r[h]);
    let corresponding_sensitire_row = sensititre_data.find(s => s[6] === accession_number); // 6 is 'column G' in the sensititre data
    if(!corresponding_sensitire_row){
        console.error(`Can't find sensititre record for Accesssion #: '${accession_number}'`);
        process.exit(2);
    }
    row = row.concat(corresponding_sensitire_row);
})