import os
import pandas as pd
import json
from common import FORMAT_PUB_PATH, GEO_SET, EARLIEST_YEAR, convert_data_source


def scan_for_pub_data(where):
    csvs = []

    # load pub metadata first:
    metadata = json.load(open(os.path.join(where, "metadata.json")))

    for entry in os.scandir(where):
        if entry.name.endswith("csv"):
            csvs.append(entry.name)

    return [metadata, csvs]


def process_sp_pub():
    print(f"Processing sp resistance publication data...")
    sp_folder = os.path.join(FORMAT_PUB_PATH, "sp")
    [metadata, csvs] = scan_for_pub_data(sp_folder)
    outgoing = []
    for filename in csvs:
        pub_name = filename.split(".")[0]
        df = pd.read_csv(os.path.join(sp_folder, filename))
        has_haplotype = (~df["type"].isin(["snp", "wt-singlepos"])).any()
        sample_size = metadata[pub_name]["count"]
        geo = metadata[pub_name]["state"]
        city = metadata[pub_name]["city"]
        date = f"{metadata[pub_name]["corrected_year"]}-01-02"
        if int(metadata[pub_name]["corrected_year"]) < EARLIEST_YEAR:
            continue

        if has_haplotype:
            # A437G, N51I-C59R-S108N
            single_triple = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c51"] == "I")
                & (df["c59"] == "R")
                & (df["c108"] == "N")
                & (df["c164"] == "I")
                & (df["c437"] == "G")
                & (df["c540"] == "K")
                & (df["c581"] == "A")
            )
            # A437G-K540E, N51I-C59R-S108N
            double_triple = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c51"] == "I")
                & (df["c59"] == "R")
                & (df["c108"] == "N")
                & (df["c164"] == "I")
                & (df["c437"] == "G")
                & (df["c540"] == "E")
                & (df["c581"] == "A")
            )

            # A437G-K540E, N51I-C59R-S108N-I164L
            double_quad = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c51"] == "I")
                & (df["c59"] == "R")
                & (df["c108"] == "N")
                & (df["c164"] == "L")
                & (df["c437"] == "G")
                & (df["c540"] == "E")
                & (df["c581"] == "A")
            )

            # A437G-K540E-A581G, N51I-C59R-S108N
            triple_triple = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c51"] == "I")
                & (df["c59"] == "R")
                & (df["c108"] == "N")
                & (df["c164"] == "I")
                & (df["c437"] == "G")
                & (df["c540"] == "E")
                & (df["c581"] == "G")
            )
        else:
            print("TODO: process snp ")

        # calculate the counts for each mutation group
        single_triple_prevalence = df.loc[single_triple, "prevalence"].sum()

        double_triple_prevalence = (
            df.loc[double_triple, "prevalence"].sum() if double_triple.any() else 0
        )

        double_quad_prevalence = (
            df.loc[double_quad, "prevalence"].sum() if double_quad.any() else 0
        )

        triple_triple_prevalence = (
            df.loc[triple_triple, "prevalence"].sum() if double_quad.any() else 0
        )
        mutations = {}
        mutations["A437G-N51I-C59R-S108N"] = single_triple_prevalence
        mutations["A437G-K540E-N51I-C59R-S108N"] = double_triple_prevalence
        mutations["A437G-K540E-N51I-C59R-S108N-I164L"] = double_quad_prevalence
        mutations["A437G-K540E-A581G-N51I-C59R-S108N"] = triple_triple_prevalence

        outgoing.append(
            {
                "source": convert_data_source(pub_name),
                "psfr": mutations,
                "geo": GEO_SET.get(geo, geo),
                "count": sample_size,
                "city": city,
                "date": date,
                "malaria": "positive",
            }
        )

    return outgoing


def process_mdr1_pub():
    print("Processing mdr1 publication data...")
    mdr1_folder = os.path.join(FORMAT_PUB_PATH, "mdr1")
    [metadata, mdr1_csvs] = scan_for_pub_data(mdr1_folder)
    outgoing = []
    for filename in mdr1_csvs:
        pub_name = filename.split(".")[0]
        df = pd.read_csv(os.path.join(mdr1_folder, filename))
        has_haplotype = (~df["type"].isin(["snp", "wt-singlepos"])).any()
        sample_size = metadata[pub_name]["count"]
        geo = metadata[pub_name]["state"]
        city = metadata[pub_name]["city"]
        condons_checked = metadata[pub_name]["codons_studied"]
        date = f"{metadata[pub_name]["corrected_year"]}-01-02"
        if int(metadata[pub_name]["corrected_year"]) < EARLIEST_YEAR:
            continue


        # problem with mdr1:
        # i.g. Beshir, 2016/2018: codons studied are only 86,184
        # but the haplotypes says YYSND, NFSND...

        if has_haplotype:
            # N86Y (strictly NYD, or any N86Y haplotypes?)
            # N86, Y184F, D1246
            # N86Y, Y184F, D1246N
            n86y_rows = (~df["type"].isin(["snp", "wt-singlepos"])) & (df["c86"] == "Y")
            N86_Y184F_D1246_rows = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c86"] == "N")
                & (df["c184"].isin(["F", "mix"]))
                & (df["c1246"] == "D")
            )
            N86Y_Y184F_D1246N_rows = (
                (~df["type"].isin(["snp", "wt-singlepos"]))
                & (df["c86"] == "Y")
                & (df["c184"] == "F")
                & (df["c1246"].isin(["N", "mix"]))
            )

        else:
            n86y_rows = (df["c86"] == "Y") & (df["type"] == "snp")

        # calculate the counts for each mutation group
        n86y_prevalence = df.loc[n86y_rows, "prevalence"].sum()
        N86_Y184F_D1246_prevalence = (
            df.loc[N86_Y184F_D1246_rows, "prevalence"].sum()
            if N86_Y184F_D1246_rows.any()
            else 0
        )

        N86Y_Y184F_D1246N_prevalence = (
            df.loc[N86Y_Y184F_D1246N_rows, "prevalence"].sum()
            if N86Y_Y184F_D1246N_rows.any()
            else 0
        )

        mutations = {}
        if "86" in condons_checked:
            mutations["N86Y"] = n86y_prevalence
        if set(["86", "184", "1246"]).issubset(condons_checked):
            mutations["N86-Y184F-D1246"] = N86_Y184F_D1246_prevalence
            # NFSND (most publication don't study c1246)
            mutations["N86Y-Y184F-D1246N"] = N86Y_Y184F_D1246N_prevalence

        outgoing.append(
            {
                "source": convert_data_source(pub_name),
                "mdr1": mutations,
                "geo": GEO_SET.get(geo, geo),
                "count": sample_size,
                "city": city,
                "date": date,
                "malaria": "positive",
            }
        )
    return outgoing


def process_crt_pub():
    print("Processing crt publication data...")
    crt_folder = os.path.join(FORMAT_PUB_PATH, "crt")
    [metadata, crt_csvs] = scan_for_pub_data(crt_folder)
    outgoing = []

    for filename in crt_csvs:
        pub_name = filename.split(".")[0]
        df = pd.read_csv(os.path.join(crt_folder, filename))
        has_haplotype = (~df["type"].isin(["snp", "wt-singlepos"])).any()
        sample_size = metadata[pub_name]["count"]
        geo = metadata[pub_name]["state"]
        city = metadata[pub_name]["city"]
        date = f"{metadata[pub_name]["corrected_year"]}-01-02"
        if int(metadata[pub_name]["corrected_year"]) < EARLIEST_YEAR:
            continue

        # K76T
        if has_haplotype:
            mutation_rows = (~df["type"].isin(["snp", "wt-singlepos"])) & (
                ~df["c76"].isin(["K", "."])
            )
        else:
            # if there's only snp rows: c76 must be 'T' or 'mixed'
            mutation_rows = df["c76"].isin(["T", "mixed"])

        prevalence = df.loc[mutation_rows, "prevalence"].sum()

        record = {
            "source": convert_data_source(pub_name),
            "crt": {"K76T": prevalence},
            "geo": GEO_SET.get(geo.capitalize(), "NA"),
            "count": sample_size,
            "city": city,
            "date": date,
            "malaria": "positive",
        }
        outgoing.append(record)
    # print(outgoing)
    return outgoing
