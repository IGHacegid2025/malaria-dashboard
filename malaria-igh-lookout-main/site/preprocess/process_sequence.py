#!/usr/bin/env python3

"""
Process dhfr and dhps sequencing data into records
Find critical haplotypes and calculate prevalences
"""

import pandas as pd
import json
import re
import os
from common import write_json, HERE, GEO_SET

SEQUENCING_PATH = os.path.join(HERE, "input", "csv", "sequencing", "2021", "csv")


# 1. identify sample columns
# strip "_HAP" to get unique sample IDs
def get_samples(df):
    cols = [c for c in df.columns if "_HAP" in c]
    return list(set([re.sub(r"_HAP\d+", "", c) for c in cols]))


def check_wt(df, mut_name, samp_id):
    # if not 1 or row with that mutation not present
    cols = [c for c in df.columns if c.startswith(samp_id)]
    row = df[df["MUTATION_ONE_LETTER"] == mut_name]
    if row.empty:
        return True
    else:
        val = row[cols].iloc[0].values
        return not ("1" in val or 1 in val)


def check_mut(df, mut_name, samp_id):
    # get columns for this sample
    cols = [c for c in df.columns if c.startswith(samp_id)]
    # check if '1' exists in any of those columns for the row with that mutation
    row = df[df["MUTATION_ONE_LETTER"] == mut_name]
    if not row.empty:
        val = row[cols].iloc[0].values
        return "1" in val or 1 in val
    return False


def process_psfr_seq(
    dhfr_filename, dhps_filename, fragment_json_filename, geo, debug=False
):
    total_samples = 0
    with open(os.path.join(SEQUENCING_PATH, "../", fragment_json_filename)) as f:
        fragment_json = json.load(f)
        total_samples = fragment_json["total_samples"]

    df_dhfr = pd.read_csv(os.path.join(SEQUENCING_PATH, dhfr_filename))
    df_dhps = pd.read_csv(os.path.join(SEQUENCING_PATH, dhps_filename))

    samples = list(set(get_samples(df_dhfr)) & set(get_samples(df_dhps)))
    if debug:
        print()
        print(f"=== {geo} ===")
        print(
            f"{len(samples)} have both dhps and dhfr info, total sample count is {total_samples}."
        )
    years = df_dhfr["Sampling_YEAR"].unique()
    outgoing = []
    for year in years:
        year_samples = samples
        haplotype_counts = {
            "A437G-K540E-A581G-N51I-C59R-S108N": 0,
            "A437G-K540E-N51I-C59R-S108N": 0,
            "A437G-K540E-N51I-C59R-S108N-I164L": 0,
            "A437G-N51I-C59R-S108N": 0,
        }

        valid_sample_count = 0

        for sample in year_samples:
            # check if sample has 1
            m = {
                "N51I": check_mut(df_dhfr, "N51I", sample),
                "C59R": check_mut(df_dhfr, "C59R", sample),
                "S108N": check_mut(df_dhfr, "S108N", sample),
                "I164L": check_mut(df_dhfr, "I164L", sample),
                "A437G": check_mut(
                    df_dhps, "G437A", sample
                ),  # the data is likely wrong, should be A437G
                "K540E": check_mut(df_dhps, "K540E", sample),
                "A581G": check_mut(df_dhps, "A581G", sample),
            }

            if debug:
                print(m)

            # "A437G-K540E-A581G-N51I-C59R-S108N"
            # "A437G-K540E-N51I-C59R-S108N-I164L"
            # "A437G-K540E-N51I-C59R-S108N"
            # "A437G-N51I-C59R-S108N"
            if (
                m["A437G"]
                and m["K540E"]
                and m["A581G"]
                and m["N51I"]
                and m["C59R"]
                and m["S108N"]
            ):
                haplotype_counts["A437G-K540E-A581G-N51I-C59R-S108N"] += 1
            elif (
                m["A437G"]
                and m["K540E"]
                and m["N51I"]
                and m["C59R"]
                and m["S108N"]
                and m["I164L"]
            ):
                haplotype_counts["A437G-K540E-N51I-C59R-S108N-I164L"] += 1
            elif m["A437G"] and m["K540E"] and m["N51I"] and m["C59R"] and m["S108N"]:
                haplotype_counts["A437G-K540E-N51I-C59R-S108N"] += 1
            elif m["A437G"] and m["N51I"] and m["C59R"] and m["S108N"]:
                haplotype_counts["A437G-N51I-C59R-S108N"] += 1

            valid_sample_count += 1

        # calculate prevalence
        psfr = {k: round(v / total_samples, 4) for k, v in haplotype_counts.items()}

        outgoing.append(
            {
                "count": total_samples,
                "date": f"{int(year)}-01-02",
                "geo": GEO_SET.get(geo.capitalize(), 'NA'),
                "malaria": "positive",
                "psfr": psfr,
                "source": "Sequencing",
            }
        )
    return outgoing


def process_mdr1_seq(mdr1_filename, fragment_json_filename, geo, debug=False):
    total_samples = 0
    with open(os.path.join(SEQUENCING_PATH, "../", fragment_json_filename)) as f:
        fragment_json = json.load(f)
        total_samples = fragment_json["total_samples"]

    df_mdr1 = pd.read_csv(os.path.join(SEQUENCING_PATH, mdr1_filename))

    samples = list(set(get_samples(df_mdr1)))
    if debug:
        print()
        print(f"=== {geo} ===")
        print(f"{len(samples)} have mdr1 info, total sample count is {total_samples}.")

    years = df_mdr1["Sampling_YEAR"].unique()

    outgoing = []

    for year in years:
        year_samples = samples
        haplotype_counts = {
            "N86Y": 0,
            "N86-Y184F-D1246": 0,  # ! includes wt
            "N86Y-Y184F-D1246N": 0,
        }

        valid_sample_count = 0

        for sample in year_samples:
            # check if sample has 1
            m = {
                "N86Y": check_mut(df_mdr1, "N86Y", sample),
                "Y184F": check_mut(df_mdr1, "Y184F", sample),
                "D1246N": check_mut(df_mdr1, "D1246N", sample),
                # below are wild types
                "N86N": check_wt(df_mdr1, "I164L", sample),
                "D1246D": check_wt(df_mdr1, "G437A", sample),
            }

            if debug:
                print(m)
            if m["N86Y"] and m["Y184F"] and m["D1246N"]:
                haplotype_counts["N86Y-Y184F-D1246N"] += 1
            elif m["N86N"] and m["Y184F"] and m["D1246D"]:
                haplotype_counts["N86-Y184F-D1246"] += 1
            elif m["N86Y"]:
                haplotype_counts["N86Y"] += 1

            valid_sample_count += 1

        # calculate prevalence
        mdr1 = {k: round(v / total_samples, 4) for k, v in haplotype_counts.items()}
        outgoing.append(
            {
                "count": total_samples,
                "date": f"{int(year)}-01-02",
                "geo": GEO_SET.get(geo.capitalize(), "NA"),
                "malaria": "positive",
                "mdr1": mdr1,
                "source": "Sequencing",
            }
        )

    return outgoing


def process_sequencing_json():
    """
    Assuming:
    1. all fragment data are generated by the SAME SET of samples
    2. if a gene appears twice (with different positions), combine them
    """
    seq_csvs = []
    crt_records = []
    exonuclease_records = []
    # mdr1_records = []
    for entry in os.scandir(SEQUENCING_PATH):
        if entry.name.endswith("json"):
            seq_csvs.append(entry.name)

    for filename in seq_csvs:
        state = filename.split("_")[0]
        state_data = json.load(open(os.path.join(SEQUENCING_PATH, filename)))
        date = f"{state_data["year"]}-01-02"
        sample_size = state_data["total_samples"]
        for data in state_data["fragments"]:
            gene = data["gene_name"]
            record = {
                "count": sample_size,
                "date": date,
                "geo": GEO_SET.get(state.capitalize(), 'NA'),
                "source": "Sequencing",
                "malaria": "positive",
            }

            if gene == "crt":  # K76T
                mutated_count = 0
                try:
                    index_of_76 = data["positions"].index(76)
                    for hap in data["haplotypes"]:
                        if hap["haplotype"][index_of_76] == "T":
                            mutated_count += 1

                    record["crt"] = {"K76T": mutated_count / sample_size}
                    crt_records.append(record)

                except ValueError:
                    # print("Position 76 not found in the this fragment.")
                    continue

            elif gene == "exonuclease":  # E415G
                mutated_count = 0
                try:
                    index_of_415 = data["positions"].index(415)
                    for hap in data["haplotypes"]:
                        if hap["haplotype"][index_of_415] == "G":
                            mutated_count += 1

                    record["exonuclease"] = {"E415G": mutated_count / sample_size}
                    exonuclease_records.append(record)

                except ValueError:
                    # print("Position 415 not found in the this fragment.")
                    continue

            elif gene == "mdr1":
                continue
                # N86Y
                # N86, Y184F, D1246
                # N86Y, Y184F, D1246N

                # in most states' sequencing data
                # (not tracking D1246)
                #  "gene_name": "mdr1",
                #   "positions": [
                #     86,
                #     102,
                #     184
                #  ]
                # => can't assum 1246 is wild type
                # exclude it from calculating prevalence?
                N86Y_count = 0
                Y184F_count = 0
                triple_count = 0
                index_of_86 = (
                    data["positions"].index(86) if 86 in data["positions"] else -1
                )
                index_of_184 = (
                    data["positions"].index(184) if 184 in data["positions"] else -1
                )
                index_of_1246 = (
                    data["positions"].index(1246) if 1246 in data["positions"] else -1
                )
                for hap in data["haplotypes"]:
                    AA86 = hap["haplotype"][index_of_86] if index_of_86 > 0 else ""
                    AA184 = hap["haplotype"][index_of_184] if index_of_184 > 0 else ""
                    AA1246 = (
                        hap["haplotype"][index_of_1246] if index_of_1246 > 0 else ""
                    )

                    if AA86 == "Y":
                        N86Y_count += 1
                    if AA86 == "N" and AA184 == "F" and AA1246 == "D":
                        Y184F_count += 1
                    if AA86 == "Y" and AA184 == "F" and AA1246 == "N":
                        triple_count += 1

                record["mdr1"] = {}
                if index_of_86 > -1:
                    # print(state)
                    record["mdr1"]["N86Y"] = N86Y_count / sample_size
                if index_of_86 > -1 and index_of_184 > -1 and index_of_1246 > -1:
                    record["mdr1"]["N86-Y184F-D1246"] = Y184F_count / sample_size
                    record["mdr1"]["N86Y-Y184F-D1246N"] = triple_count / sample_size

                mdr1_records.append(record)

    return [crt_records, exonuclease_records]


if __name__ == "__main__":
    result_json = process_psfr_seq(
        "Adamawa-dhfr.csv", "Adamawa-dhps.csv", "Adamawa_haplotypes_by_fragment.json"
    )
    write_json(os.path.join(SEQUENCING_PATH, "Adamawa-psfr.json"), result_json)

    print("done.")
