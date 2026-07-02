#!/usr/bin/env python3
import os
import json
import pandas as pd
from common import (
    read_csv,
    write_json,
    PUB_FOLDER,
    OUTPUT_PATH,
    GEO_SET,
    EARLIEST_YEAR,
    int_or_none,
    float_or_none,
    convert_data_source,
)
from process_sequence import get_samples, SEQUENCING_PATH

# issues found:
# kelch13.csv (publication):  sample size is not an int:  "not quite clear, 16-58 blood samples used for molecular analysis"


def process_k13_seq(k13_filename, fragment_json_filename, geo, debug=False):
    total_samples = 0
    with open(os.path.join(SEQUENCING_PATH, "../", fragment_json_filename)) as f:
        fragment_json = json.load(f)
        total_samples = fragment_json["total_samples"]
        try: 
            df = pd.read_csv(os.path.join(SEQUENCING_PATH, k13_filename))
        except Exception as e:
            # print(e)
            print(f"No {k13_filename} found.")
            return []

        gene_key = "kelch13"  

        # Identify unique samples in this specific file
        samples_in_file = get_samples(df)
        if debug: 
            print(f"=== {geo} ({gene_key}) ===")
            print(f"{len(samples_in_file)} samples found in file,  total sample count is  {total_samples}.")

        years = df['Sampling_YEAR'].unique()
        outgoing = []

        for year in years:
            df_year = df[df['Sampling_YEAR'] == year]
            # record every mutation found in the data as a separate haplotype
            gene_data = {}
            unique_mutations = df_year['MUTATION_ONE_LETTER'].unique()

            for mut in unique_mutations:
                #  take the prevalence value directly from the data
                prevalence = df_year[df_year['MUTATION_ONE_LETTER'] == mut]['Prevalence (Sample Level)'].iloc[0]
                gene_data[mut] = round(float(prevalence), 4)

            outgoing.append(
                {
                    "count": total_samples,
                    "date": f"{int(year)}-01-02",
                    "geo": GEO_SET.get(geo.title(), geo),
                    "malaria": "positive",
                    gene_key: gene_data,
                    "source": "Sequencing",
                }
            )

        return outgoing


def process_k13_pub():
    print(f"Processing kelch13 publication data...")
    k13pub = read_csv(os.path.join(PUB_FOLDER, "kelch13.csv"))
    outgoing = []
    pubs = []

    for row in k13pub:
        wtaa = row["WT AA"].strip()
        mtaa = row["mutant AA"].strip()
        codon = row["codon"].split(".")[0].strip()
        mutation = f"{wtaa}{codon}{mtaa}"
        if mutation == "" or not mutation:
            continue
        if int(row["corrected year"]) < EARLIEST_YEAR:
            continue
        key = f"{row["Author"]}-{row["year of publication"]}-{row["state"]}"
        if key not in pubs:
            pubs.append(key)
            record = {
                "count": int_or_none(row["sample size Nigeria only"]),
                "malaria": "positive",
                "geo": GEO_SET.get(row["state"].title(), row["state"]),
                "city": row["city"],
                "date": f"{row["corrected year"]}-01-02",
                "kelch13": {mutation: float_or_none(row["prevalence"])},
                "source": convert_data_source(key),
            }
            outgoing.append(record)
        else:
            for record in outgoing:
                if record["source"] == key:
                    record["kelch13"][mutation] = float_or_none(row["prevalence"])

    return outgoing


if __name__ == "__main__":
    result_json = process_k13_pub()
    write_json(os.path.join(OUTPUT_PATH, "k13_pub.json"), result_json)
    print("done.")
