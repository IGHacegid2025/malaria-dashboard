#!/usr/bin/env python3

"""
Transform sequencing and publication data into record-based format
"""

import os
import json
import pandas as pd
from collections import defaultdict

from common import (
    write_json,
    read_csv,
    int_or_none,
    PUB_FOLDER,
    GEO_SET,
    OUTPUT_PATH,
    SEQUENCING_FOLDERS,
    INPUT_PATH,
    EARLIEST_YEAR,
)
from process_pub import (
    process_crt_pub,
    process_mdr1_pub,
    process_sp_pub,
)
from kelch13 import process_k13_pub


def process_MIS_cases():
    # https://dhsprogram.com/pubs/pdf/MIS41/MIS41.pdf p.124
    # Malaria in Children (Table 4.8.2)
    outgoing = []
    for entry in os.scandir(os.path.join(INPUT_PATH, "MIS")):
        if entry.name.endswith("csv"):
            year = int_or_none(entry.name.split(".")[0][-4:])
            if year:
                case_data = read_csv(
                    os.path.join(INPUT_PATH, "MIS", f"positive_{year}.csv")
                )

                for row in case_data:
                    if row["State"] == "Total":
                        continue
                    # total_count = int(row["Number of children (Microscopy)"])
                    # pos_count = round(0.01 * float(row["Microscopy positive"]) * total_count)
                    # neg_count = total_count - pos_count
                    positivity = 0.01 * float(row["Microscopy positive"])
                    geo = GEO_SET[row["State"]]

                    pos_rec = {
                        "date": f"{year}-01-02",
                        "count": positivity,
                        "malaria": "positive",
                        "geo": geo,
                        "MIS": True,
                    }
                    outgoing.append(pos_rec)
    return outgoing


def process_moi_seq():
    outgoing = []
    for year, year_path in SEQUENCING_FOLDERS:
        drugs_path = os.path.join(year_path, "drugs")
        if not os.path.exists(drugs_path):
            continue
        for entry in os.scandir(drugs_path):
            if not entry.name.endswith("json"):
                continue
            with open(os.path.join(drugs_path, entry.name)) as f:
                sample_summary_by_state = json.load(f)
                state_name = entry.name.split("_")[0].title()
                geo = GEO_SET.get(state_name)
                if geo is None:
                    print(f"Skipping {entry.name}: unrecognized state '{state_name}'")
                    continue

                moi_count_map = {}

                for sample in sample_summary_by_state:
                    sample_moi = int(sample["sample_MOI"])
                    if sample_moi in moi_count_map:
                        moi_count_map[sample_moi] += 1
                    else:
                        moi_count_map[sample_moi] = 1

                for moi, count in moi_count_map.items():
                    outgoing.append(
                        {
                            "geo": geo,
                            "date": f"{year}-01-02",
                            "malaria": "positive",
                            "moi": moi,
                            "count": count,
                            "source": "Sequencing",
                        }
                    )

    return outgoing


def process_hrp_seq():
    outgoing = []
    for year, year_path in SEQUENCING_FOLDERS:
        seq_hrp = read_csv(os.path.join(year_path, "hrp_deletion_sequencing.csv"))
        for row in seq_hrp:
            geo = GEO_SET.get(row["state"].strip(), "NA")
            date = f"{year}-01-02"
            if int(row["hrp3 deletion"]) > 0:
                outgoing.append(
                    {
                        "geo": geo,
                        "date": date,
                        "malaria": "positive",
                        "hrp_mutation": "hrp3",
                        "source": "Sequencing",
                        "count": int(row["hrp3 deletion"]),
                    }
                )

            if int(row["hrp2 deletion"]) > 0:
                outgoing.append(
                    {
                        "geo": geo,
                        "date": date,
                        "malaria": "positive",
                        "hrp_mutation": "hrp2",
                        "any_hrp_mutation": "true",
                        "source": "Sequencing",
                        "count": int(row["hrp2 deletion"]),
                    }
                )

            count = (
                int(row["total"])
                - int(row["hrp2 deletion"])
                - int(row["hrp3 deletion"])
            )
            if count > 0:
                outgoing.append(
                    {
                        "geo": geo,
                        "date": date,
                        "malaria": "positive",
                        "hrp_mutation": "none",
                        "source": "Sequencing",
                        "count": count,
                    }
                )

    return outgoing


def process_hrp_pub():
    pub_hrp = read_csv(os.path.join(PUB_FOLDER, "hrp_deletion_publication.csv"))
    outgoing = []

    for row in pub_hrp:
        loc = row["location"].strip()
        geo = GEO_SET.get(row["state"].strip(), "NA")
        date = f"{row["corrected year of sample collection"]}-01-02"
        if int(row["corrected year of sample collection"]) < EARLIEST_YEAR:
            continue

        # dual deletion
        count = int(row["Number of DUAL (pfhrp2 + pfhrp3) deletions"]) > 0
        if count > 0:
            outgoing.append(
                {
                    "location": loc,
                    "geo": geo,
                    "date": date,
                    "malaria": "positive",
                    "hrp_mutation": "dual",
                    "source": f"{row["\ufeffSurname of First Author"]}, {row["Year of Publication"]}",
                    "count": int(row["Number of DUAL (pfhrp2 + pfhrp3) deletions"]),
                }
            )

        # hrp2
        count = int(row["Number of pfhrp2 deletions found"]) - int(
            row["Number of DUAL (pfhrp2 + pfhrp3) deletions"]
        )
        if count > 0:
            outgoing.append(
                {
                    "location": loc,
                    "geo": geo,
                    "date": date,
                    "malaria": "positive",
                    "hrp_mutation": "hrp2",
                    "source": f"{row["\ufeffSurname of First Author"]}, {row["Year of Publication"]}",
                    "count": count,
                }
            )

        # hrp3
        count = int(row["Number of pfhrp3 deletions found"]) - int(
            row["Number of DUAL (pfhrp2 + pfhrp3) deletions"]
        )
        if count > 0:
            outgoing.append(
                {
                    "location": loc,
                    "geo": geo,
                    "date": date,
                    "malaria": "positive",
                    "hrp_mutation": "hrp3",
                    "source": f"{row["\ufeffSurname of First Author"]}, {row["Year of Publication"]}",
                    "count": count,
                }
            )

        # none
        count = (
            int(row["Total samples tested for delections"])
            - int(row["Number of pfhrp3 deletions found"])
            - int(row["Number of pfhrp2 deletions found"])
            + int(row["Number of DUAL (pfhrp2 + pfhrp3) deletions"])
        )
        if count > 0:
            outgoing.append(
                {
                    "location": loc,
                    "geo": geo,
                    "date": date,
                    "malaria": "positive",
                    "hrp_mutation": "none",
                    "source": f"{row["\ufeffSurname of First Author"]}, {row["Year of Publication"]}",
                    "count": count,
                }
            )

    return outgoing


def process_sequencing_csvs():
    # sample sizes for data source are not accurate
    # we care the most about total number of samples maybe?
    all_recs = []
    MARKER_KEY_MAP = {"k13": "kelch13", "dhps/dhfr": "psfr"}
    for year, year_path in SEQUENCING_FOLDERS:
        drug_path = os.path.join(year_path, "drugs")
        if not os.path.exists(drug_path):
            continue

        print(f"Processing sequencing data from {year}...")
        for entry in os.scandir(drug_path):
            if entry.name.endswith("csv"):
                rows = read_csv(os.path.join(drug_path, entry.name))
                [_, state] = entry.name.split(".")[0].split("-")
                geo = GEO_SET.get(state.title())
                if geo is None:
                    print(f"Skipping {entry.name}: unrecognized state '{state}'")
                    continue
                # group rows by marker
                marker_groups = defaultdict(list)
                for row in rows:
                    marker_groups[row["Marker"]].append(row)

                # one record per marker
                for marker, marker_rows in marker_groups.items():
                    hap_key = MARKER_KEY_MAP.get(marker, marker)

                    haplotypes = {}
                    for row in marker_rows:
                        haplotype_key = (
                            row["Validated haplotype"]
                            .strip()
                            .replace(", ", "-")
                            .replace(" ", "-")
                            .replace("/", "-")
                        )
                        haplotypes[haplotype_key] = float(row["Calculated Prevalence"])
                    count = int(
                        marker_rows[0][
                            "Denominator (Sample size/Samples_Pass_This_Fragment)"
                        ]
                    )
                    if count > 0:
                        rec = {
                            "count": count,
                            "geo": geo,
                            "malaria": "positive",
                            "source": "Sequencing",
                            "date": f"{year}-01-02",
                            hap_key: haplotypes,
                        }

                        all_recs.append(rec)
    return all_recs


def process_pSpecies():
    outgoing = []
    for year, year_path in SEQUENCING_FOLDERS:
        path = os.path.join(year_path, "Speciation_summary.csv")
        csv = read_csv(path)

        species_list = ["pf", "pv", "pm", "po", "pk"]
        cols = [
            "Pf only",
            "Pv only",
            "Pm only",
            "Po only",
            "Pk only",
            "Pf and Pv",
            "Pf and Pm",
            "Pf and Po",
            "Pf and Pk",
            "Pf and Pm and Po",
            "Pf and Pm and Pk",
            "Pf and Po and Pk",
        ]

        for row in csv:
            if not row["State"]:
                continue

            record = {
                "geo": GEO_SET.get(row["State"].strip(), "NA"),
                "date": f"{year}-01-02",
                "malaria": "positive",
                "species": [],
                "source": "Sequencing",
            }

            all_pos = str(row["all positive"]).strip().upper()
            all_neg = str(row["negative for all"]).strip().upper()

            if all_pos == "TRUE":
                record["species"] = species_list.copy()
                outgoing.append(record)
                continue

            if all_neg == "TRUE":
                continue

            matched_species = set()

            for col in cols:
                if str(row[col]).strip().upper() == "TRUE":
                    col_lower = col.lower()
                    for s in species_list:
                        if s in col_lower:
                            matched_species.add(s)

            if not matched_species:
                continue

            record["species"] = sorted(matched_species)
            outgoing.append(record)

    return outgoing


def make_records():
    # ========== publication ==========
    mdr1_pub_data = process_mdr1_pub()
    sp_pub_data = process_sp_pub()
    kelch13_pub_data = process_k13_pub()
    crt_pub_data = process_crt_pub()
    # no exonuclease, mdr2, or ferredoxin from publication data

    merged = {}
    all_pub = mdr1_pub_data + sp_pub_data + kelch13_pub_data + crt_pub_data
    for entry in all_pub:
        group_key = (
            entry["date"],
            entry["geo"],
            entry["count"],
            entry["malaria"],
            entry["source"],
        )

        if group_key not in merged:
            merged[group_key] = entry.copy()
        else:
            merged[group_key].update(entry)

    merged_pub = list(merged.values())

    # ========== sequencing ==========

    # Sheets contain selected markers only", ";
    # columns are sample_ID_HAP;
    # '.' means missing;
    # empty/duplicate haplotypes removed.
    # Proportion (Clonal Level) ignores '.' and measures fraction of non-missing haplotype calls that are mutated (!=0).
    # Prevalence (Sample Level) counts unique samples with any mutated haplotype call (!=0) divided by total samples in state.

    # 1. can/should I use the MOI info from the old sequencing data (Dec 2, 2025)
    # Adamawa_summary.json
    # because they're not present in the new files
    # 2. Missing plasmodium species detected info.

    all_sequencing = []
    # [crt_seq_data, exonuclease_seq_data] = process_sequencing_json()  # crt, exonuclease
    all_sequencing = process_sequencing_csvs()

    # all_sequencing.extend(crt_seq_data + exonuclease_seq_data + seq_data)
    # group sequencing data by date-geo
    # merged = {}
    # for entry in all_sequencing:
    #     group_key = (
    #         entry["date"],
    #         entry["geo"],
    #         entry["count"],
    #         entry["malaria"],
    #         entry["source"],
    #     )

    #     if group_key not in merged:
    #         merged[group_key] = entry.copy()
    #     else:
    #         merged[group_key].update(entry)

    # merged_sequencing = list(merged.values())

    drug_resist_dataset = {
        "fields": [
            "date",
            "crt",
            "mdr1",
            "kelch13",
            "ferredoxin",
            "coronin",
            "psfr",
            "exonuclease",
            "geo",
            "source",
            "malaria",
            "hrp_mutation",
            "any_hrp_mutation",
            "moi",
            "species",
        ],
        "records": [],
    }
    drug_resist_dataset["records"] = (
        merged_pub
        + all_sequencing
        + process_hrp_pub()
        + process_hrp_seq()
        + process_moi_seq()
        + process_pSpecies()
    )

    MIS_dataset = {
        "fields": ["geo", "date", "MIS", "malaria"],
        "records": [],
    }
    MIS_dataset["records"] = process_MIS_cases()

    write_json(
        os.path.join(OUTPUT_PATH, "records.json"),
        [drug_resist_dataset, MIS_dataset],
    )

    print(f"Record data witten to {os.path.join(OUTPUT_PATH, "records.json")}")


if __name__ == "__main__":
    make_records()
    print("done.")
