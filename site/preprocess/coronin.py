#!/usr/bin/env python3
import os
from common import (
    read_csv,
    PUB_FOLDER,
    GEO_SET,
    EARLIEST_YEAR,
    int_or_none,
    convert_data_source,
)


def process_coronin_pub():
    print(f"Processing coronin publication data...")
    coronin_pub = read_csv(os.path.join(PUB_FOLDER, "coronin.csv"))
    records_by_key = {}
    current_key = None
    current_count = None

    for row in coronin_pub:
        author = row["Author"].strip()
        if author:
            current_key = None
            year_of_pub = row["year of publication"].split(".")[0].strip()
            year = row["year of sample collection"].split("-")[0].strip()
            state = row["state"].strip()
            if not year or not state:
                continue
            if int(year) < EARLIEST_YEAR:
                continue
            key = f"{author}-{year_of_pub}-{state}"
            current_key = key
            current_count = int_or_none(row["sample size Nigeria only"])
            if key not in records_by_key:
                records_by_key[key] = {
                    "count": current_count,
                    "malaria": "positive",
                    "geo": GEO_SET.get(state.title(), state),
                    "city": row["city"],
                    "date": f"{year}-01-02",
                    "coronin": {},
                    "source": convert_data_source(key),
                }

        if not current_key:
            continue

        mutation = row["mutation"].strip()
        if not mutation or mutation == "0":
            continue

        prevalence = round(1 / current_count, 4) if current_count else None
        records_by_key[current_key]["coronin"][mutation] = prevalence

    return list(records_by_key.values())
