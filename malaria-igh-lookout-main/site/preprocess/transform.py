#!/usr/bin/env python3

"""
Transforms publication data into a uniformed format in csv
Expands all states' sequencing data into separate csvs
Write geneconfig.json from information_for_report.csv
"""

import re
import os
import json
import shutil
from pathlib import Path
import pandas as pd
from common import (
    read_csv,
    write_csv,
    write_json,
    PUB_FOLDER,
    HERE,
    INPUT_PATH,
    OUTPUT_PATH,
)
from recordmaker import make_records

# https: //en.wikipedia.org/wiki/States_of_Nigeria
STATES = [
    "Abia",
    "Adamawa",
    "Akwa Ibom",
    "Anambra",
    "Bauchi",
    "Bayelsa",
    "Benue",
    "Borno",
    "Cross River",
    "River",  # cross river
    "Delta",
    "Ebonyi",
    "Edo",
    "Ekiti",
    "Enugu",
    "FCT",
    "Gombe",
    "Imo",
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Kogi",
    "Kwara",
    "Lagos",
    "Nasarawa",
    "Niger",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
    "Plateau",
    "Rivers",
    "Sokoto",
    "Taraba",
    "Yobe",
    "Zamfara",
]

CODON_LISTS = {
    "crt": ["72", "73", "74", "75", "76"],
    "mdr1": ["86", "184", "1034", "1042", "1246"],  # "1192",
    "dhfr_sp": ["51", "59", "108", "164"],
    "dhps_sp": ["431", "436", "437", "540", "581", "613"],
    "dhfr": ["16", "50", "51", "59", "108", "140", "164"],
    "dhps": ["424", "431", "436", "437", "540", "581", "613"],
}

categories = ["wild type", "single", "double", "triple", "quadruple", "quintuple"]


HAPLOTYPE_TYPES = {
    "mdr1": {
        "NYSND": "wt-sequence",
        "YYSND": "single",
        "NFSND": "single",
        "NYSNY": "single",
        "YFSND": "double",
        "YYSNY": "double",
        "NFSNY": "double",
        "YYSDD": "double",
        "NYSND-T1192L": "single",
    },
    "crt": {
        "CVMNK": "wt-sequence",
        "CVMNN": "single",
        "CVINK": "single",
        "CVMEK": "single",
        "CVMNT": "single",
        "CVIEK": "double",
        "CVMET": "double",
        "CVMDT": "double",
        "CVIKT": "triple",
        "CVMNK/CVIET": "wt/triple mixed",
        "CVIET": "triple",
    },
    "dhfr": {},
    "dhps": {},
}

SINGLE_CODONS = {
    "mdr1": {
        "wt_cols": [
            "N86",
            "Y184",
            "N1042",
            "D1246",
        ],
        "snp_cols": [
            "N86Y/N mixed",
            "N86Y",
            "Y184F",
            "184 mixed",
            "S1034",
            "1042 mixed",
            "N1042D",
            "1246 mixed",
            "D1246Y",
        ],
    },
    "crt": {"wt_cols": [], "snp_cols": ["K76T", "K76T/K mixed", "total"]},
    "dhfr": {
        "wt_cols": [
            "16 wt",
            "50 wt",
            "N51",
            "C59",
            "140 wt",
            "164 wt",
            "S108",
        ],
        "snp_cols": [
            "N51I",
            "51 mixed",
            "C59R",
            "59 mixed",
            "S108N",
            "108 mixed",
            "S108T",
            "I164L",
            "164 mixed",
        ],
    },
    "dhps": {
        "wt_cols": ["431wt", "S436", "A437", "K540", "A581", "A613"],
        "snp_cols": [
            "I431V",
            "I431V/I mixed",
            "S436A",
            "S436A/S mixed",
            "S436F",
            "S436C",
            "S436Y",
            "A437G",
            "A437G/A mixed",
            "K540E",
            "K540E/K mixed",
            "A581G",
            "A581A/G mixed",
            "A613S",
            "A613A/S mixed mixed",
            "A613T",
            "A613T/A mixed",
        ],
    },
}


def int_or_none(str):
    try:
        return int(str)
    except:
        return None


def float_or_none(str):
    try:
        return float(str)
    except:
        return None


def float_or_zero(str):
    try:
        return float(str)
    except:
        return 0


def percent_to_float(str):
    if str:
        num = float_or_zero(str.split("%")[0])
        return round(num * 0.01, 10) if num else 0
    else:
        return None


def get_empty_codon_row(marker):
    """
    create a dict with c+position keys initialized to '.'
    """
    if marker == "dhfr/dhps":
        positions = CODON_LISTS["dhfr_sp"] + CODON_LISTS["dhps_sp"]
    else:
        positions = CODON_LISTS[marker]
    return {f"c{p}": "." for p in positions}


def empty_dir(folder):
    try:
        shutil.rmtree(folder)
    except FileNotFoundError:
        print(f"{folder} not found or is already empty.")
    except OSError as e:
        print(f"Error removing folder: {e}")


def format_haplotypes(s):
    if "/" in s:
        head, tail = s.split("/", 1)
        return "-".join(head) + "/" + "-".join(tail)
    if "-" in s:
        head, tail = s.split("-", 1)
        return "-".join(head) + "-" + tail
    else:
        return "-".join(s)


def map_haplotype_to_columns(marker, haplotype, item):
    # 1. mdr1 specific thing
    is_1192L = "-T1192L" in haplotype
    clean_hap = haplotype.replace("-T1192L", "")

    # 2. dhps, dhfr format
    # 51I & 59R,
    # 51I & 108N,
    # 59R & 108N,
    # 51I & 59R & 108N,
    # 51I & 59R & 108N & 164L
    if "&" in clean_hap or " + " in clean_hap:
        # Extract all mutation pairs like ('51', 'I')
        found_muts = re.findall(r"(\d+)([A-Z])", clean_hap)
        mut_dict = {pos: aa for pos, aa in found_muts}

        for pos in CODON_LISTS.get(marker, []):
            if pos in mut_dict:
                item[f"c{pos}"] = mut_dict[pos]
            else:
                item[f"c{pos}"] = "."
        return

    # 4. string-based haplotypes (CVMNK, NYSND)
    # crt, mdr1
    variants = clean_hap.split("/")
    for i, pos in enumerate(CODON_LISTS.get(marker, [])):
        if marker == "mdr1" and pos == "1192":
            item["c1192"] = "L" if is_1192L else "T"
            continue

        alleles = []
        for v in variants:
            v_clean = v.replace("-", "")
            if i < len(v_clean):
                alleles.append(v_clean[i])

        unique_alleles = sorted(list(set(alleles)))
        item[f"c{pos}"] = "/".join(unique_alleles) if unique_alleles else "."


def cleanup():
    mdr1_folder = os.path.join(HERE, "output", "mdr1")
    # cleanup_folder = os.path.join(mdr1_folder, "cleanedup")
    # os.makedirs(cleanup_folder, exist_ok=True)
    metadata_path = os.path.join(mdr1_folder, "metadata.json")

    with open(metadata_path) as f:
        metadata = json.load(f)

    mdr1_csvs = []
    for entry in os.scandir(mdr1_folder):
        if entry.is_file() and entry.name.endswith(".csv"):
            mdr1_csvs.append(entry.name)

    for filename in mdr1_csvs:
        key = filename.split(".")[0]
        if key not in metadata:
            continue

        codons_studied = metadata[key]["codons_studied"]
        data = read_csv(os.path.join(mdr1_folder, filename))

        processed_rows = []
        for row in data:
            new_row = row.copy()
            for col_name in row.keys():
                if col_name[0] == "c" and col_name.split("c")[1] not in codons_studied:
                    new_row[col_name] = "."

            processed_rows.append(new_row)

        write_csv(os.path.join(mdr1_folder, filename), processed_rows)


def process_haplotypes(marker, row, pub):
    outgoing = []

    # add dhps haplotypes map
    if marker == "dhps":
        haps = [
            "431V & 436A",
            "431V & 437G",
            "436A & 437G",
            "436V & 437G",
            "436A & 613S",
            "436A & 581G",
            "436F & 613S",
            "436Y & 613S",
            "437G & 540E",
            "437G & 581G",
            "437G & 613S",
            "431V & 436A & 437G",
            "431V & 436A & 581G",
            "431V & 437G & 581G",
            "431V & 437G & 613S",
            "436A & 437G & 581G",
            "436A & 437G & 613S",
            "436A & 581G & 613S",
            "437G & 581G & 613S",
            "437G & 581G & 424G",
            "431V & 437G & 581G & 613S",
            "431V & 436A & 437G & 613S",
            "431V & 436A & 437G & 540E",
            "431V & 436A & 437G & 581G",
            "436A & 437G & 581G & 613S",
            "431V & 436A & 581G & 613S",
            "431V & 436A & 437G & 581G & 613S",
        ]
        for hap in haps:
            HAPLOTYPE_TYPES[marker][hap] = categories[len(hap.split("&"))]

    elif marker == "dhfr":
        haps = [
            "51I & 59R",
            "51I & 108N",
            "59R & 108N",
            "51I & 59R & 108N",
            "51I & 59R & 108N & 164L",
        ]
        for hap in haps:
            HAPLOTYPE_TYPES[marker][hap] = categories[len(hap.split("&"))]

    for haplotype, mutation_type in HAPLOTYPE_TYPES[marker].items():
        if haplotype not in row or not row[haplotype]:
            continue

        raw_prevalence = row[haplotype]
        prevalence = (
            percent_to_float(raw_prevalence)
            if isinstance(raw_prevalence, str) and "%" in raw_prevalence
            else float_or_none(raw_prevalence)
        )

        if prevalence is not None:
            # init with marker, type, prevalence, and all '.'
            item = {
                "marker": marker,
                "type": mutation_type,
                "prevalence": f"{prevalence:.4f}",
            }
            item.update(get_empty_codon_row(marker))
            map_haplotype_to_columns(marker, haplotype, item)
            outgoing.append(item)

    if outgoing:
        out_path = os.path.join(HERE, "output", marker)
        os.makedirs(out_path, exist_ok=True)
        write_csv(os.path.join(out_path, f"{pub}.csv"), outgoing)


def extract_metadata(row):
    codons = row.get("codons studied", "")
    metadata = {
        "author": row["Author"],
        "publication_year": row["year of publication"],
        "state": row["state"],
        "city": row["city"],
        "sample_collection_year": row["year of sample collection"],
        "count": int_or_none(row["sample size Nigeria only"]),
        "codons_studied": codons.split(", ") if codons else None,
        "study focus": row["study focus"],
        "corrected_year": row["corrected year"],
    }
    return metadata


def process_single_pos(studied_list, marker, mutation, m_type, source_row):
    # 1. extract the codon digit
    pos_match = re.search(r"\d+", mutation)
    if not pos_match:
        return None
    pos = pos_match.group()

    # 2. check the amino acid (letter) based on the string
    mutation_lower = mutation.lower()

    # Pattern A
    standard_match = re.search(r"\d+([A-Z])", mutation)

    # Pattern B: wild types
    # if it's labeled 'wt' or just has a leading letter with no trailing letter
    is_wt = "wt" in mutation_lower or re.match(r"^[A-Z]\d+$", mutation)

    if "mixed" in mutation_lower:
        # for mixed, try to find the mutant AA to show the mix (e.g., "I/N")
        lead_aa = re.match(r"([A-Z])", mutation)
        amino_acid = f"mix"
        if lead_aa:  # otherwise just show mix
            amino_acid = "mix"
    elif is_wt:
        # extract leading AA if exists
        lead_aa = re.match(r"([A-Z])", mutation)
        amino_acid = lead_aa.group(1) if lead_aa else "wt"
    elif standard_match:
        # extract trailing AA
        amino_acid = standard_match.group(1)
    else:
        # fallback
        amino_acid = mutation[-1] if mutation[-1].isalpha() else "alt"

    # 3. check if this position was actually studied
    if not studied_list or pos in studied_list:
        raw_val = source_row.get(mutation, "0")
        prevalence = (
            percent_to_float(raw_val)
            if isinstance(raw_val, str) and "%" in raw_val
            else float_or_none(raw_val)
        )

        if prevalence is not None and prevalence > 0:
            item = {
                "marker": marker,
                "type": m_type,
                "prevalence": f"{prevalence:.4f}",
            }
            item.update(get_empty_codon_row(marker))

            item[f"c{pos}"] = amino_acid
            return item

    return None


def add_singles(marker, hap_rows, row, pub_dir):
    studied_list = (
        row["codons studied"].replace(",", " ").split()
        if "codons studied" in row
        else []
    )

    mutation_types = [("wt_cols", "wt-singlepos"), ("snp_cols", "snp")]
    for col_key, label in mutation_types:
        for mutation in SINGLE_CODONS[marker].get(col_key, []):
            if mutation:
                hap_row = process_single_pos(studied_list, marker, mutation, label, row)
                if hap_row:
                    hap_rows.append(hap_row)

    if hap_rows:
        write_csv(pub_dir, hap_rows)


def process_data_by_marker(marker, hap_path, snp_path=""):
    marker_dir = os.path.join(HERE, "output", marker)

    empty_dir(marker_dir)
    os.makedirs(marker_dir)

    hap_csv = read_csv(hap_path)
    snp_csv = read_csv(snp_path) if snp_path else []
    all_metadata = {}

    # haplotype data

    # dhfr Beshir-2018 and Beshir-2016 are tracking two study groups separately
    # need to save as separate files

    for row in hap_csv:
        pub = f"{row['Author']}-{row['corrected year']}-{row["state"]}"
        all_metadata[pub] = extract_metadata(row)
        process_haplotypes(marker, row, pub)

    existing_pubs = {entry.name.replace(".csv", "") for entry in os.scandir(marker_dir)}

    # SNP
    for row in snp_csv:
        pub = f"{row['Author']}-{row['corrected year']}"
        pub_dir = os.path.join(HERE, "output", marker, f"{pub}.csv")
        if pub in existing_pubs:
            hap_rows = read_csv(pub_dir)
            add_singles(marker, hap_rows, row, pub_dir)
        else:
            add_singles(marker, [], row, pub_dir)
            # all_metadata[pub] = extract_metadata(row)

    write_json(os.path.join(HERE, "output", marker, "metadata.json"), all_metadata)


def process_sp_data():
    csv_path = os.path.join(PUB_FOLDER, "dhps_dhfr_combined.csv")

    outpath = os.path.join(HERE, "output/sp")
    empty_dir(outpath)

    if not os.path.exists(outpath):
        os.makedirs(outpath)

    dhps_codons = ["431", "436", "437", "540", "581", "613"]
    dhfr_codons = ["51", "59", "108", "164"]
    wt_dhps = "SAAKAA"
    wt_dhfr = "NCSI"

    all_metadata = {}

    def parse_mutations(mutation_string):
        mutations = {}
        if not mutation_string or mutation_string == "na":
            return mutations
        for mutation in mutation_string.replace(" ", "").split(","):
            position = mutation[:-1]
            amino_acid = mutation[-1]
            mutations[position] = amino_acid
        return mutations

    def build_haplotype(mutations, codon_positions, wild_type):
        return "".join(
            mutations.get(pos, wild_type[i]) for i, pos in enumerate(codon_positions)
        )

    def get_mutation_type(dhps_count, dhfr_count):
        return f"{categories[dhfr_count]}/{categories[dhps_count]}"

    # 1. process all CSVs
    pub_data = {}
    sp_csv = read_csv(csv_path)
    for row in sp_csv:
        pub = f"{row['Author']}-{row['corrected year']}-{row["state"]}"
        all_metadata[pub] = extract_metadata(row)

        if "or" in row["haplotype DHPS"]:
            continue

        dhps_mutations = parse_mutations(row["haplotype DHPS"])
        dhfr_mutations = parse_mutations(row["haplotype DHFR"])

        dhps_hap = build_haplotype(dhps_mutations, dhps_codons, wt_dhps)
        dhfr_hap = build_haplotype(dhfr_mutations, dhfr_codons, wt_dhfr)

        row_data = {
            "marker": "dhfr/dhps",
            "type": get_mutation_type(len(dhps_mutations), len(dhfr_mutations)),
            "prevalence": (
                f"{percent_to_float(row['prevalence']):.4f}"
                if "%" in row["prevalence"]
                else f"{float_or_none(row['prevalence']):.4f}"
            ),
        }
        row_data.update(get_empty_codon_row("dhfr/dhps"))

        for i, aa in enumerate(dhfr_hap):
            row_data[f"c{dhfr_codons[i]}"] = aa
        for i, aa in enumerate(dhps_hap):
            row_data[f"c{dhps_codons[i]}"] = aa

        if pub not in pub_data:
            pub_data[pub] = []
        pub_data[pub].append(row_data)

    # 2. write data
    for pub, outgoing in pub_data.items():
        write_csv(os.path.join(outpath, f"{pub}.csv"), outgoing)

    # 3. add special row bc there's
    # A437G, 540E, A581G or 613S
    xu_path = os.path.join(outpath, "Xu-2015.csv")
    if os.path.exists(xu_path):
        xu_data = read_csv(xu_path)
        special_row = {
            "marker": "dhfr/dhps",
            "type": "triple/triple",
            "prevalence": 0.0560,
        }
        special_row.update(get_empty_codon_row("dhfr/dhps"))

        # manually mapping for: dhfr I-R-N-I (51-59-108-164) and dhps mixed
        # Xu-2015 mixed (G-E-G-A/G-E-A-S),
        special_row.update(
            {
                "c51": "I",
                "c59": "R",
                "c108": "N",
                "c164": "I",
                "c431": "S",
                "c436": "A",
                "c437": "G",
                "c540": "E",
                "c581": "G/A",
                "c613": "A/S",
            }
        )
        xu_data.append(special_row)
        write_csv(xu_path, xu_data)

    # 4. write metadata
    write_json(os.path.join(HERE, "output", "sp", "metadata.json"), all_metadata)


def add_state_column():
    """
    Adding state & city level info to each row in the gene data by looking up all_pub_information
    """
    cleaned_xlsx = []
    input_dir = os.path.join(INPUT_PATH, "../", "260210_cleaned")
    output_dir = os.path.join(INPUT_PATH, "../", "cleaned_w_state")

    os.makedirs(output_dir, exist_ok=True)

    for entry in os.scandir(input_dir):
        if entry.is_file() and entry.name.endswith(".xlsx"):
            cleaned_xlsx.append(entry.name)

    # build lookup table
    allpub_lookup = {}
    allpub_doi_lookup = {}
    for row in allpub_info:
        key = f"{row['Author']}-{row['corrected year']}"
        allpub_lookup[key] = {
            "state": row["state_province"],
            "city": row["city_village"],
        }
        key = f"{row['doi']}"
        allpub_doi_lookup[key] = {
            "state": row["state_province"],
            "city": row["city_village"],
        }

    for filename in cleaned_xlsx:
        gene_name = filename.split(".")[0]
        print(f"\n===== {gene_name} ======")

        df = pd.read_excel(os.path.join(input_dir, filename))

        row_counts = 0
        has_state_counts = 0
        total_rows = len(df)

        for idx, row in df.iterrows():
            try:
                key = f"{row['Author']}-{row['corrected year']}"

                if pd.isna(row.get("state")) or row.get("state") == "":
                    if key in allpub_lookup:

                        match = allpub_lookup.get(key)
                        if match:
                            df.at[idx, "state"] = match["state"]
                            df.at[idx, "city"] = match["city"]
                            row_counts += 1
                    else:
                        key = f"{row['doi']}"
                        if key in allpub_doi_lookup:
                            match = allpub_doi_lookup.get(key)
                            if match:
                                df.at[idx, "state"] = match["state"]
                                df.at[idx, "city"] = match["city"]
                                row_counts += 1

                else:
                    print(f"{key} already has state info: {row["state"]}")
                    has_state_counts += 1
            except Exception as e:
                print(
                    "Error processing",
                    gene_name,
                    row.get("Author"),
                    row.get("corrected year"),
                    e,
                )

        print(
            f"Added state info: {row_counts} rows. "
            f"Total row count: {total_rows}. "
            f"No state info: {total_rows - row_counts-has_state_counts} rows."
        )

        out_path = os.path.join(output_dir, f"{gene_name}.csv")
        df.to_csv(out_path, index=False)

    return


def xlsx_to_csv(in_folder, out_folder):
    """convert excel files with multiple sheets into separate csvs"""
    xlsxs = []
    Path(out_folder).mkdir(exist_ok=True)
    for entry in os.scandir(in_folder):
        if entry.is_file() and entry.name.endswith(".xlsx"):
            xlsxs.append(entry.name)

    for filename in xlsxs:
        print(f"opening {filename}")
        # df = pd.read_excel(os.path.join(in_folder, filename))
        # df.to_csv(
        #     os.path.join(out_folder, filename.split(".")[0] + ".csv"), index=False
        # )
        try:

            sheets = pd.read_excel(os.path.join(in_folder, filename), sheet_name=None)

            for sheet_name, df in sheets.items():
                state_name = filename.split("_")[0]
                safe_name = sheet_name.replace(" ", "_").lower()
                if safe_name == "readme":
                    continue
                out_path = Path(out_folder) / f"{state_name}-{safe_name}.csv"
                df.to_csv(out_path, index=False)
        except Exception as e:
            print(f"Skipping {filename}: {e}")
            continue


def write_gene_config():
    """
    FORMAT
    marker|haplotype-joined: [
      {
        antimalarial: "",
        thresholds: [low, med, high],
        guidelines: ["LOW", "MED", "HIGH" ],
        message: ["LOW", "MED", "HIGH" ],
      }
    ]
    """
    config = {}
    csv = read_csv(os.path.join(INPUT_PATH, "information_for_report.csv"))

    for row in csv:
        marker = "psfr" if row["Marker"] == "dhps/dhfr" else row["Marker"]
        antimalarial = row["antimalarial"]
        haplotypes = [
            part.strip()
            for h in row["haplotype"].split(",")
            for part in h.strip().split("/")
        ]
        haplotype = "-".join(haplotypes)
        if (
            haplotype == "any additional mutation-haplotype"
            or haplotype == "any additional mutation"
        ):
            haplotype = "*"

        key = f"{marker}|{haplotype}"
        if not antimalarial:
            continue
        # try to find an existing entry for this marker + haplotype
        if key in config:
            if antimalarial == config[key]["antimalarial"]:
                config[key]["thresholds"].append(float(row["max"]))
                config[key]["guidelines"].append(row["comment"])
                config[key]["messages"].append(row["message"])
                config[key]["classifications"].append(row["classification"])
                config[key]["blurb"].append(row["bullet points"])
            else:
                print(
                    marker, haplotype, "antimalarials do not match. Check spreadsheet."
                )
        else:
            entry = {
                "antimalarial": antimalarial,
                "thresholds": [float(row["max"])],
                "classifications": [row["classification"]],
                "guidelines": [row["comment"]],
                "messages": [row["message"]],
                "blurb": [row["bullet points"]],
                "resistance": row["resistance level"],
                "link": row["comment"],
            }
            config[key] = entry

    write_json(os.path.join(OUTPUT_PATH, "geneConfig.json"), config)
    print(
        "Alert level information written to: ",
        os.path.join(OUTPUT_PATH, "geneConfig.json"),
    )


allpub_info = []


def main():
    global allpub_info
    allpub_info = read_csv(os.path.join(PUB_FOLDER, "all_publications_information.csv"))
    write_gene_config()

    process_data_by_marker("mdr1", os.path.join(PUB_FOLDER, "mdr1_hap.csv"))
    process_data_by_marker("crt", os.path.join(PUB_FOLDER, "crt_hap.csv"))
    process_data_by_marker("dhps", os.path.join(PUB_FOLDER, "dhps_hap.csv"))
    process_data_by_marker("dhfr", os.path.join(PUB_FOLDER, "dhfr_hap.csv"))

    process_sp_data()
    cleanup()
    make_records()


if __name__ == "__main__":
    main()
    print("done.")
