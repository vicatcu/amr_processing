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

let combined_isolates_data = parse(combined_isolates_csv, {columns: true})
let starting_number = combined_isolates_data.map(r => r['Unique Specimen ID'].slice(-4))
    .filter(v => v.trim()) // get rid of blanks
    .reduce((t,v) => +v > t ? +v : t, -Infinity) // find the maximum value
if(starting_number === -Infinity){
    starting_number = 0;
}
starting_number++;
console.log(`starting number will be ${zeroFill(4, starting_number)}`);

combined_isolates_data.filter(r => r.Include.toLowerCase() === 'yes');

const sensititre_data = parse(sensititre_csv, {delimiter: '\t'})
console.log(combined_output_headers);
console.log(combined_isolates_data[0])
console.log(combined_isolates_data.map(r => r['Accession #']));