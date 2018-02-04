const fs = require('fs');
const path = require('path');

const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify/lib/sync');
const argv = require('minimist')(process.argv.slice(2));
const zeroFill = require('zero-fill');

const lab_name = argv.lab || 'NY - Cornell University Animal Health Diagnostic Center';
const combined_output_headers = (argv.combined_output_headers || 'Laboratory Name,Unique Specimen ID,State of Animal Origin,Animal Species,Reason for submission ,Program Name,Specimen/ source tissue,Bacterial Organism Isolated,Salmonella Serotype,Final Diagnosis ,Date of Isolation').split(",");
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

const atb_species_drug_map = {
    'Bovine':  ['AMPICI','CEFTIF','CHLTET','CLINDA','DANOFL','ENROFL','FLORFE','','GENTAM','NEOMYC','OXYTET','PENICI','SDIMET','SPECT','','TIAMUL','TILMIC','','TRISUL','TULATH','TYLO'],
    'Porcine': ['AMPICI','CEFTIF','CHLTET','CLINDA','DANOFL','ENROFL','FLORFE','','GENTAM','NEOMYC','OXYTET','PENICI','SDIMET','SPECT','','TIAMUL','TILMIC','','TRISUL','TULATH','TYLO'],
    'Chicken': ['AMOXIC','CEFTIF','CLINDA','ENROFL','ERYTH','FLORFE','GENTAM','NEOMYC','NOVOBI','OXYTET','PENICI','SDIMET','SPECT','STREPT','SULTHI','TETRA','TRISUL','TYLO'],
    'Turkey':  ['AMOXIC','CEFTIF','CLINDA','ENROFL','ERYTH','FLORFE','GENTAM','NEOMYC','NOVOBI','OXYTET','PENICI','SDIMET','SPECT','STREPT','SULTHI','TETRA','TRISUL','TYLO'],
    'Duck':    ['AMOXIC','CEFTIF','CLINDA','ENROFL','ERYTH','FLORFE','GENTAM','NEOMYC','NOVOBI','OXYTET','PENICI','SDIMET','SPECT','STREPT','SULTHI','TETRA','TRISUL','TYLO'],
    'Equine':  ['AMIKAC','AMPICI','AZITHR','CEFAZO','CEFTAZ','CEFTIF','CHLORA','CLARYT','DOXYCY','ENROFL','ERYTH','GENTAM','IMIPEN','OXACIL','PENICI','RIFAM','TETRA','TICARC','TICCLA','TRISUL'], // Note: guessed RIFAM for Rifampin
    'Canine':  {
        'dog-cat GN': {
            'drug_map': [],
            'organism_regex': /(Escherichia coli)|(Salmonella species)/
        },
        'dog-cat GP': {
            'drug_map': [],
            'organism_regex': /(Staphylococcus)/
        }
    },
    'Feline':  []
};

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
    let drug_data = r.slice(40);
    let consolidated_drug_data = [];
    // there are 100 wells worth of data, 3 columns per well
    for(let i = 0; i < 100; i++){
        const base = i * 3;
        const a = drug_data[base], b = drug_data[base+1], c = drug_data[base+2];
        if(a.trim() || b.trim() || c.trim()){
            consolidated_drug_data = consolidated_drug_data.concat([a,b,c]);
        }

    }
    return [date_value].concat(consolidated_drug_data);
});

let allOutputDataRows = combined_isolates_data.map((r, idx) => {
    const accession_number =  r['Accession #'];    
    let row = combined_output_headers.map(h => {
        switch(h){
        case 'Laboratory Name': return lab_name;
        case 'Unique Specimen ID': return unique_name_prefix + zeroFill(4, starting_number++);
        case 'Program Name': return ''; //TODO: should this be filled in somehow
        case 'Final Diagnosis ': return ''; //TODO: should this be filled in somehow
        default: return r[h];
        }                
    });
    let corresponding_sensitire_row = sensititre_data.findIndex(s => s[6] === accession_number); // 6 is 'column G' in the sensititre data
    if(corresponding_sensitire_row < 0){
        console.error(`Can't find sensititre record for Accesssion #: '${accession_number}'`);
        process.exit(2);
    }
    return row.concat(post_sensitire_data[corresponding_sensitire_row]);
})

let allOutputDataRowsByAnimalSpecies = {};
const speciesIndex = combined_output_headers.indexOf('Animal Species');
allOutputDataRows.forEach(r => {
    let species = r[speciesIndex];
    if(!allOutputDataRowsByAnimalSpecies[species]){
        allOutputDataRowsByAnimalSpecies[species] = [];
    }
    allOutputDataRowsByAnimalSpecies[species].push(r);
});

console.dir(Object.keys(allOutputDataRowsByAnimalSpecies)
    .map((k) => {
        return {
            species: k,
            count: allOutputDataRowsByAnimalSpecies[k].length
        }
    }) 
)

const atb_offset = combined_output_headers.length + 1;    
Object.keys(allOutputDataRowsByAnimalSpecies).forEach((species) => {    
    const species_drug_map = atb_species_drug_map[species];    
    const species_has_organism_partition = !Array.isArray(species_drug_map);

    if(species_has_organism_partition){
        const organism_partitions = Object.keys(species_drug_map);
        organism_partitions.forEach((partition) => {            
            const obj = species_drug_map[partition];            
            const drug_map = obj.drug_map;
            const organism_regex = obj.organism_regex;
            const rows = allOutputDataRowsByAnimalSpecies[species].filter(r => organism_regex.test(r[7])); // r[7] is the Bacterial Organism Isolated
            const meta_species = [species, partition];
            expandSpeciesRows(meta_species, rows, drug_map);    
        });
    } else {
        const rows = allOutputDataRowsByAnimalSpecies[species];
        expandSpeciesRows(species, rows, species_drug_map);
    }
});

function expandSpeciesRows(species, rows, species_drug_map){
    const num_target_drugs = species_drug_map.length;
    if(num_target_drugs === 0){
        console.log(`Warning: Species '${species}' has no drug map`);
        return;
    }
    const newRows = rows.map((row, idx) => {
        const targetDrugContent = Array(num_target_drugs * 3).fill('');
        for(let i = atb_offset; row[i]; i += 3){
            const a = row[i], b = row[i+1], c = row[i+2];
            const drugIndex = species_drug_map.indexOf(a);
            if(drugIndex < 0){
                console.error(`Encountered unknown drug '${a}' in species '${species}' Sensititre data`);
                process.exit(3);
            }
            const base = drugIndex * 3;
            targetDrugContent[base] = a;
            targetDrugContent[base+1] = b;
            targetDrugContent[base+2] = c;
        }
        
        const newRow = row.slice(0, atb_offset).concat(targetDrugContent).map(v => `"=""${v}"""`)
        return newRow;
    });

    effectiveSpeciesTarget = allOutputDataRowsByAnimalSpecies;
    if(!Array.isArray(species)){
        species = [species];
    }
    while(species.length != 1){
        const s = species.shift();
        effectiveSpeciesTarget = effectiveSpeciesTarget[s];
    }
    species = species.shift();
    allOutputDataRowsByAnimalSpecies[species] = newRows;    
}