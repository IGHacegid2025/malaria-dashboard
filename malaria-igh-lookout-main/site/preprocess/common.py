import os
import csv
import json
from datetime import date, datetime

HERE = os.path.dirname(os.path.realpath(__file__))
INPUT_PATH = os.path.join(HERE, "input")
OUTPUT_PATH = os.path.join(os.path.dirname(HERE), "data")
FORMAT_PUB_PATH = os.path.join(HERE, "output")

PUB_FOLDER = os.path.join(INPUT_PATH, "publication")
SEQUENCING_ROOT = os.path.join(HERE, "input", "sequencing")
          
SEQUENCING_FOLDERS = [
    (entry.name, entry.path)
    for entry in sorted(os.scandir(SEQUENCING_ROOT), key=lambda x: x.name)
    if entry.is_dir() and entry.name.isdigit()
]

# TODO
# better error messages in preprocess
# add data source set (full author, title, year, doi)

if not os.path.exists(OUTPUT_PATH):
    os.makedirs(OUTPUT_PATH)

YMD_FMT = "%y%m%d"  # e.g. 211210
LONG_FMT = "%Y-%m-%d"  # 2021-12-10
FULL_FMT = r"%Y-%m-%d"  # 2021-12-10

MIN_STAMP = "2000-01-02"
MAX_STAMP = date.today().strftime(LONG_FMT)
MIN_DATE = datetime.strptime(MIN_STAMP, LONG_FMT)
MAX_DATE = datetime.strptime(MAX_STAMP, LONG_FMT)

EARLIEST_YEAR = 2015


GEO_SET = {
    "Abia": "AB",
    "Adamawa": "AD",
    "Akwa Ibom": "AK",
    "Anambra": "AN",
    "Bauchi": "BA",
    "Bayelsa": "BY",
    "Benue": "BE",
    "Borno": "BO",
    "Cross River": "CR",
    "Delta": "DE",
    "Ebonyi": "EB",
    "Edo": "ED",
    "Ekiti": "EK",
    "Enugu": "EN",
    "FCT": "FC",
    "FCT-Abuja": "FC",  # Abuja Federal Capital Territory
    "Gombe": "GO",
    "Imo": "IM",
    "Jigawa": "JI",
    "Kaduna": "KD",
    "Kano": "KN",
    "Katsina": "KT",
    "Kebbi": "KE",
    "Kogi": "KO",
    "Kwara": "KW",
    "Lagos": "LA",
    "Nasarawa": "NA",
    "Niger": "NI",
    "Ogun": "OG",
    "Ondo": "ON",
    "Osun": "OS",
    "Oyo": "OY",
    "Ibadan": "OY",  # some data has Ibadan city as state field
    "Plateau": "PL",
    "Rivers": "RI",
    "Sokoto": "SO",
    "Taraba": "TA",
    "Yobe": "YO",
    "Zamfara": "ZA",
}


def convert_data_source(raw):
    source = raw.split("-")
    loc = source[-1]
    source.pop()
    dsource = ", ".join(source )# + f". {loc}"
    return dsource

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


def write_csv(out_path, data):
    with open(out_path, "w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)


def read_csv(input_path, delimiter=","):
    outgoing = []
    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for line in reader:
            outgoing.append(line)
    return outgoing


def read_tsv(input_path, delimiter="\t"):
    outgoing = []
    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        for line in reader:
            outgoing.append(line)
    return outgoing


def write_json(path, outgoing):
    with open(path, "w") as f:
        json.dump(outgoing, f, indent=2, separators=(",", ": "), sort_keys=True)
