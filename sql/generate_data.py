#!/usr/bin/env python3
# Builds 03_data.sql from the preprocessing outputs.
# Author: Khadim Gueye

import csv
import json
import os
import re
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.realpath(__file__))
SITE = os.path.join(HERE, "..", "site")
RECORDS_PATH = os.path.join(SITE, "data", "records.json")
GENE_CONFIG_PATH = os.path.join(SITE, "data", "geneConfig.json")
PUB_INFO_PATH = os.path.join(SITE, "preprocess", "input", "publication", "all_publications_information.csv")
HRP_PUB_PATH = os.path.join(SITE, "preprocess", "input", "publication", "hrp_deletion_publication.csv")
OUTPUT_PATH = os.path.join(HERE, "03_data.sql")

BATCH_SIZE = 500

STATES = [
    ("AB", "Abia"), ("AD", "Adamawa"), ("AK", "Akwa Ibom"), ("AN", "Anambra"),
    ("BA", "Bauchi"), ("BY", "Bayelsa"), ("BE", "Benue"), ("BO", "Borno"),
    ("CR", "Cross River"), ("DE", "Delta"), ("EB", "Ebonyi"), ("ED", "Edo"),
    ("EK", "Ekiti"), ("EN", "Enugu"), ("FC", "Federal Capital Territory"), ("GO", "Gombe"),
    ("IM", "Imo"), ("JI", "Jigawa"), ("KD", "Kaduna"), ("KN", "Kano"),
    ("KT", "Katsina"), ("KE", "Kebbi"), ("KO", "Kogi"), ("KW", "Kwara"),
    ("LA", "Lagos"), ("NA", "Nasarawa"), ("NI", "Niger"), ("OG", "Ogun"),
    ("ON", "Ondo"), ("OS", "Osun"), ("OY", "Oyo"), ("PL", "Plateau"),
    ("RI", "Rivers"), ("SO", "Sokoto"), ("TA", "Taraba"), ("YO", "Yobe"),
    ("ZA", "Zamfara"),
]

GENES = ["crt", "mdr1", "mdr2", "kelch13", "dhfr", "dhps", "psfr", "coronin", "ferredoxin", "exonuclease"]


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    text = str(value).replace("\\", "\\\\").replace("'", "''").replace("\n", "\\n").replace("\r", "")
    return f"'{text}'"


def insert_statements(table, columns, rows):
    if not rows:
        return []
    header = f"INSERT INTO {table} ({', '.join(columns)}) VALUES"
    statements = []
    for start in range(0, len(rows), BATCH_SIZE):
        chunk = rows[start:start + BATCH_SIZE]
        values = ",\n".join("  (" + ", ".join(sql_value(v) for v in row) + ")" for row in chunk)
        statements.append(f"{header}\n{values};")
    return statements


def clean_text(value):
    if value is None:
        return None
    value = value.replace("\u00a0", " ").strip()
    return value or None


def split_source(source):
    match = re.match(r"^(.*),\s*(\d{4})$", source.strip())
    if not match:
        raise ValueError(f"Unrecognised publication source: {source!r}")
    return match.group(1).strip(), int(match.group(2))


def surname_key(author):
    return re.split(r"[\s,\-]+", author.strip().lower())[0]


def normalise_doi(raw):
    doi = clean_text(raw)
    if not doi:
        return None
    return re.sub(r"^(https?://)?(dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)


def load_publication_info():
    sources = [
        (PUB_INFO_PATH, "Author", "year of publication", "doi", "title", "corrected year"),
        (HRP_PUB_PATH, "Surname of First Author", "Year of Publication", "DOI", "Title",
         "corrected year of sample collection"),
    ]
    papers = {}
    for path, author_col, year_col, doi_col, title_col, sample_col in sources:
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                author = clean_text(row.get(author_col))
                year = clean_text(row.get(year_col))
                doi = normalise_doi(row.get(doi_col))
                if not author or not year or not year.isdigit() or not doi:
                    continue
                paper = papers.setdefault(doi.lower(), {
                    "author": author,
                    "year": int(year),
                    "doi": doi,
                    "title": clean_text(row.get(title_col)),
                    "sample_years": set(),
                })
                paper["sample_years"].update(int(y) for y in re.findall(r"\d{4}", row.get(sample_col) or ""))
    return list(papers.values())


def find_publication(papers, author, year):
    candidates = [p for p in papers if surname_key(p["author"]) == surname_key(author)]
    for rule in (lambda p: p["year"] == year, lambda p: year in p["sample_years"], lambda p: True):
        matches = [p for p in candidates if rule(p)]
        if len(matches) == 1:
            return matches[0]
        if matches:
            return None
    return None


def prevalence_value(raw, context):
    value = round(float(raw), 6)
    if value < 0 or value > 1:
        raise ValueError(f"Prevalence out of range in {context}: {raw}")
    return value


def main():
    with open(RECORDS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    with open(GENE_CONFIG_PATH, encoding="utf-8") as f:
        gene_config = json.load(f)
    pub_info = load_publication_info()

    drug_records = data[0]["records"]
    mis_records = data[1]["records"]

    state_ids = {code: i for i, (code, _) in enumerate(STATES, start=1)}
    gene_ids = {name: i for i, name in enumerate(GENES, start=1)}

    mutation_ids = OrderedDict()
    publication_ids = OrderedDict()
    publication_rows = []
    source_to_publication = {}
    source_labels = []
    batch_ids = OrderedDict()

    observation_rows = []
    species_counts = OrderedDict()
    hrp_rows = []
    moi_counts = OrderedDict()
    skipped_geo = defaultdict(int)
    unmatched_publications = []

    for record in drug_records:
        geo = record.get("geo")
        state_id = state_ids.get(geo)
        if state_id is None:
            skipped_geo[geo] += 1
            continue
        year = int(record["date"][:4])
        count = record.get("count")

        if record["source"] == "Sequencing":
            source_type = "sequencing"
            pub_id = None
            batch_key = (state_id, year)
            if batch_key not in batch_ids:
                batch_ids[batch_key] = len(batch_ids) + 1
            batch_id = batch_ids[batch_key]
        else:
            source_type = "publication"
            batch_id = None
            if record["source"] not in source_to_publication:
                author, label_year = split_source(record["source"])
                paper = find_publication(pub_info, author, label_year)
                if paper:
                    pub_key = paper["doi"].lower()
                    row = (paper["author"], paper["year"], paper["doi"], paper["title"])
                else:
                    pub_key = (author, label_year)
                    row = (author, label_year, None, None)
                    unmatched_publications.append(record["source"])
                if pub_key not in publication_ids:
                    publication_ids[pub_key] = len(publication_ids) + 1
                    publication_rows.append((publication_ids[pub_key],) + row)
                source_to_publication[record["source"]] = publication_ids[pub_key]
                source_labels.append((record["source"], row[0], row[1], row[2]))
            pub_id = source_to_publication[record["source"]]

        city = clean_text(record.get("city"))

        for gene in GENES:
            mutations = record.get(gene)
            if not isinstance(mutations, dict):
                continue
            for code, raw in mutations.items():
                mutation_key = (gene_ids[gene], code)
                if mutation_key not in mutation_ids:
                    mutation_ids[mutation_key] = len(mutation_ids) + 1
                observation_rows.append((
                    mutation_ids[mutation_key], state_id, year, source_type, pub_id, batch_id, city,
                    prevalence_value(raw, f"{record['source']} {geo} {gene} {code}"), count,
                ))

        species = record.get("species")
        if species:
            combination = ",".join(species) if isinstance(species, list) else str(species)
            key = (state_id, year, source_type, pub_id, batch_id, combination)
            species_counts[key] = species_counts.get(key, 0) + (count if count is not None else 1)

        deletion = record.get("hrp_mutation")
        if deletion:
            if deletion not in ("hrp2", "hrp3", "dual", "none"):
                raise ValueError(f"Unknown hrp value: {deletion}")
            flag = record.get("any_hrp_mutation")
            if isinstance(flag, str):
                flag = flag.strip().lower() == "true" if flag.strip() else None
            hrp_rows.append((
                state_id, year, source_type, pub_id, batch_id, deletion, flag,
                clean_text(record.get("location")), count,
            ))

        moi = record.get("moi")
        if moi is not None:
            if batch_id is None:
                raise ValueError(f"MOI outside sequencing data: {record}")
            key = (batch_id, int(moi))
            moi_counts[key] = moi_counts.get(key, 0) + count

    mis_rows = OrderedDict()
    for record in mis_records:
        state_id = state_ids.get(record.get("geo"))
        if state_id is None:
            skipped_geo[record.get("geo")] += 1
            continue
        year = int(record["date"][:4])
        key = (state_id, year)
        if key in mis_rows:
            raise ValueError(f"Duplicate MIS entry for {record['geo']} {year}")
        mis_rows[key] = prevalence_value(record["count"], f"MIS {record['geo']}")

    rule_rows = []
    level_rows = []
    for rule_id, (key, cfg) in enumerate(gene_config.items(), start=1):
        gene, pattern = key.split("|", 1)
        antimalarial = cfg.get("antimalarial")
        rule_rows.append((
            rule_id, gene, pattern,
            None if antimalarial in (None, "", "NA") else antimalarial,
            cfg.get("resistance") or None,
            cfg.get("link") or None,
        ))
        thresholds = cfg.get("thresholds", [])
        for i, threshold in enumerate(thresholds):
            level_rows.append((
                rule_id, i + 1, threshold, cfg["classifications"][i],
                cfg["guidelines"][i] if i < len(cfg.get("guidelines", [])) else None,
                cfg["messages"][i] if i < len(cfg.get("messages", [])) else None,
                cfg["blurb"][i] if i < len(cfg.get("blurb", [])) else None,
            ))

    statements = [
        "-- Malaria Dashboard data, generated by generate_data.py",
        "-- Author: Khadim Gueye",
        "",
        "USE malaria_dashboard;",
        "SET NAMES utf8mb4;",
        "START TRANSACTION;",
    ]
    statements += insert_statements(
        "states", ["id", "code", "name"],
        [(state_ids[code], code, name) for code, name in STATES],
    )
    statements += insert_statements("genes", ["id", "name"], [(i, n) for n, i in gene_ids.items()])
    statements += insert_statements(
        "mutations", ["id", "gene_id", "mutation_code"],
        [(i, g, c) for (g, c), i in mutation_ids.items()],
    )
    statements += insert_statements(
        "publications", ["id", "author", "year_of_publication", "doi", "title"], publication_rows,
    )
    statements += insert_statements(
        "sequencing_batches", ["id", "state_id", "year"],
        [(i, s, y) for (s, y), i in batch_ids.items()],
    )
    statements += insert_statements(
        "observations",
        ["mutation_id", "state_id", "year", "source_type", "publication_id", "sequencing_batch_id",
         "city", "prevalence", "sample_count"],
        observation_rows,
    )
    statements += insert_statements(
        "species_observations",
        ["state_id", "year", "source_type", "publication_id", "sequencing_batch_id",
         "species_combination", "sample_count"],
        [key + (n,) for key, n in species_counts.items()],
    )
    statements += insert_statements(
        "hrp_deletions",
        ["state_id", "year", "source_type", "publication_id", "sequencing_batch_id",
         "deletion_type", "any_hrp_mutation", "location", "sample_count"],
        hrp_rows,
    )
    statements += insert_statements(
        "moi_distribution", ["sequencing_batch_id", "moi_value", "sample_count"],
        [key + (n,) for key, n in moi_counts.items()],
    )
    statements += insert_statements(
        "mis_prevalence", ["state_id", "year", "prevalence"],
        [key + (p,) for key, p in mis_rows.items()],
    )
    statements += insert_statements(
        "alert_rules", ["id", "gene", "mutation_pattern", "antimalarial", "resistance_level", "reference_text"],
        rule_rows,
    )
    statements += insert_statements(
        "alert_levels",
        ["alert_rule_id", "level_order", "max_prevalence", "classification", "guideline", "message", "summary"],
        level_rows,
    )
    statements.append("COMMIT;")

    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n\n".join(statements) + "\n")

    print(f"states: {len(STATES)}")
    print(f"genes: {len(gene_ids)}")
    print(f"mutations: {len(mutation_ids)}")
    print(f"publications: {len(publication_rows)}")
    print(f"sequencing_batches: {len(batch_ids)}")
    print(f"observations: {len(observation_rows)}")
    print(f"species_observations: {len(species_counts)}")
    print(f"hrp_deletions: {len(hrp_rows)}")
    print(f"moi_distribution: {len(moi_counts)}")
    print(f"mis_prevalence: {len(mis_rows)}")
    print(f"alert_rules: {len(rule_rows)}")
    print(f"alert_levels: {len(level_rows)}")
    if skipped_geo:
        print("skipped records outside Nigeria: " + ", ".join(f"{g} ({n})" for g, n in skipped_geo.items()))
    for label, author, year, doi in source_labels:
        print(f"  {label:<28} -> {author}, {year}  {doi or 'NO DOI'}")
    if unmatched_publications:
        print("publications without doi/title: " + "; ".join(unmatched_publications))
    print(f"written: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
