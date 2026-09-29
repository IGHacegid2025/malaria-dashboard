#!/usr/bin/env python3
# Author: Khadim Gueye

import json
import os
import re
import psycopg2

HERE = os.path.dirname(os.path.realpath(__file__))
RECORDS_PATH = os.path.join(HERE, "..", "site", "data", "records.json")

CONN_INFO = dict(
    host="127.0.0.1",
    port=5433,
    dbname="malaria_dashboard",
    user="malaria_admin",
    password="malaria_pass_2026",
)

GENE_FIELDS = ["crt", "mdr1", "kelch13", "ferredoxin", "coronin", "psfr", "exonuclease"]


def year_from_date(date_str):
    return int(date_str.split("-")[0])


def get_or_create_state(cur, state_cache, code):
    if code in state_cache:
        return state_cache[code]
    cur.execute("SELECT id FROM states WHERE code = %s", (code,))
    row = cur.fetchone()
    state_cache[code] = row[0] if row else None
    return state_cache[code]


def get_or_create_gene(cur, gene_cache, name):
    if name in gene_cache:
        return gene_cache[name]
    cur.execute("SELECT id FROM genes WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        gene_cache[name] = row[0]
    else:
        cur.execute("INSERT INTO genes (name) VALUES (%s) RETURNING id", (name,))
        gene_cache[name] = cur.fetchone()[0]
    return gene_cache[name]


def get_or_create_mutation(cur, mutation_cache, gene_id, code):
    key = (gene_id, code)
    if key in mutation_cache:
        return mutation_cache[key]
    cur.execute(
        "SELECT id FROM mutations WHERE gene_id = %s AND mutation_code = %s",
        (gene_id, code),
    )
    row = cur.fetchone()
    if row:
        mutation_cache[key] = row[0]
    else:
        cur.execute(
            "INSERT INTO mutations (gene_id, mutation_code) VALUES (%s, %s) RETURNING id",
            (gene_id, code),
        )
        mutation_cache[key] = cur.fetchone()[0]
    return mutation_cache[key]


def parse_source_author_year(source):
    match = re.match(r"^(.*),\s*(\d{4})$", source.strip())
    if match:
        return match.group(1).strip(), int(match.group(2))
    return source.strip(), None


def get_or_create_publication(cur, pub_cache, record, state_id, year):
    author, pub_year = parse_source_author_year(record["source"])
    key = (author, pub_year, state_id)
    if key in pub_cache:
        return pub_cache[key]
    cur.execute(
        """
        INSERT INTO publications (author, year_of_publication, state_id, city, sample_size, corrected_year)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            author,
            pub_year if pub_year is not None else year,
            state_id,
            record.get("city"),
            record.get("count"),
            year,
        ),
    )
    pub_cache[key] = cur.fetchone()[0]
    return pub_cache[key]


def get_or_create_batch(cur, batch_cache, state_id, year, count):
    key = (state_id, year)
    if key in batch_cache:
        return batch_cache[key]
    cur.execute(
        """
        INSERT INTO sequencing_batches (year, state_id, total_samples)
        VALUES (%s, %s, %s)
        RETURNING id
        """,
        (year, state_id, count),
    )
    batch_cache[key] = cur.fetchone()[0]
    return batch_cache[key]


def migrate():
    with open(RECORDS_PATH) as f:
        data = json.load(f)

    drug_resist_records = data[0]["records"]
    mis_records = data[1]["records"]

    conn = psycopg2.connect(**CONN_INFO)
    cur = conn.cursor()

    state_cache = {}
    gene_cache = {}
    mutation_cache = {}
    pub_cache = {}
    batch_cache = {}

    observation_count = 0
    species_count = 0
    hrp_count = 0
    moi_count = 0

    for record in drug_resist_records:
        state_id = get_or_create_state(cur, state_cache, record.get("geo"))
        if state_id is None:
            continue
        year = year_from_date(record["date"])
        is_sequencing = record.get("source") == "Sequencing"

        if is_sequencing:
            batch_id = get_or_create_batch(cur, batch_cache, state_id, year, record.get("count"))
            pub_id = None
            source_type = "sequencing"
        else:
            pub_id = get_or_create_publication(cur, pub_cache, record, state_id, year)
            batch_id = None
            source_type = "publication"

        for gene in GENE_FIELDS:
            mutations = record.get(gene)
            if not isinstance(mutations, dict):
                continue
            gene_id = get_or_create_gene(cur, gene_cache, gene)
            for mutation_code, prevalence in mutations.items():
                mutation_id = get_or_create_mutation(cur, mutation_cache, gene_id, mutation_code)
                cur.execute(
                    """
                    INSERT INTO observations
                        (mutation_id, state_id, year, source_type, publication_id, sequencing_batch_id, prevalence, sample_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        mutation_id,
                        state_id,
                        year,
                        source_type,
                        pub_id,
                        batch_id,
                        prevalence,
                        record.get("count"),
                    ),
                )
                observation_count += 1

        species = record.get("species")
        if species:
            cur.execute(
                """
                INSERT INTO species_observations
                    (state_id, year, source_type, publication_id, sequencing_batch_id, species_combination, sample_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    state_id,
                    year,
                    source_type,
                    pub_id,
                    batch_id,
                    ", ".join(species) if isinstance(species, list) else str(species),
                    record.get("count"),
                ),
            )
            species_count += 1

        hrp_mutation = record.get("hrp_mutation")
        if hrp_mutation in ("hrp2", "hrp3", "none"):
            any_hrp_mutation = record.get("any_hrp_mutation")
            if isinstance(any_hrp_mutation, str):
                any_hrp_mutation = any_hrp_mutation.lower() == "true"
            cur.execute(
                """
                INSERT INTO hrp_deletions
                    (state_id, year, source_type, publication_id, sequencing_batch_id, gene, any_hrp_mutation, location, sample_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    state_id,
                    year,
                    source_type,
                    pub_id,
                    batch_id,
                    hrp_mutation,
                    any_hrp_mutation,
                    record.get("location"),
                    record.get("count"),
                ),
            )
            hrp_count += 1

        moi = record.get("moi")
        if moi is not None and batch_id is not None:
            cur.execute(
                """
                INSERT INTO moi_distribution (sequencing_batch_id, moi_value, sample_count)
                VALUES (%s, %s, %s)
                """,
                (batch_id, int(moi), record.get("count")),
            )
            moi_count += 1

    mis_count = 0
    for record in mis_records:
        state_id = get_or_create_state(cur, state_cache, record.get("geo"))
        if state_id is None:
            continue
        year = year_from_date(record["date"])
        cur.execute(
            """
            INSERT INTO mis_cases (state_id, year, prevalence, malaria, is_mis)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (state_id, year, record.get("count"), record.get("malaria"), record.get("MIS")),
        )
        mis_count += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"publications: {len(pub_cache)}")
    print(f"sequencing_batches: {len(batch_cache)}")
    print(f"mutations: {len(mutation_cache)}")
    print(f"observations: {observation_count}")
    print(f"species_observations: {species_count}")
    print(f"hrp_deletions: {hrp_count}")
    print(f"moi_distribution: {moi_count}")
    print(f"mis_cases: {mis_count}")


if __name__ == "__main__":
    migrate()
