# Lookout Dashboard for IGH Malaria

This readme walks you through two things:
1. **Running the app locally** to view the dashboard
2. **Updating the data** when new information is available

---

## Run the App Locally

### Get the code

You can get the project files in one of two ways:

**Option A: Download as a zip**
- Click the green Code button on this page and select **Download ZIP**
- Unzip the downloaded file

**Option B: Clone with Git**

```bash
git clone git@github.com:fathominfo/malaria-igh-min.git
cd malaria-igh-min
```

### Download the data

The dashboard requires a data folder that isn't included in the repository.

1. Download the data [here](https://drive.google.com/file/d/13VPZU7qsjMpmnIQ6ED9lkHEVCxl4N-rI/view?usp=drive_link).
2. After downloading, place the `/data` folder inside `/malaria-igh-min/site/` so the structure looks like this:

```
malaria-igh-min/
└── site/
    └── data/
```

### Start the local server

On macOS:

Double-click the file named `server.tool` at the root of the project folder. It will open a terminal and launch the app in your browser automatically. Or, you can run it from the terminal

```bash
./server.tool
```

On Windows: 

Rename `server.tool` to `server.py`. Make sure you have python3 installed, then at the root of the folder, run: 

```bash
python3 ./server.py
```

Then open your browser and go to: **http://localhost:9200/**

---

## Incorporate Data Changes

Follow these steps whenever new data needs to be added to the dashboard.

Navigate to the preprocessing directory

```bash
cd ./site/preprocess
```

### Set up your Python environment

This only needs to be done once. It installs the tools the data-processing script relies on.

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # installs required packages
```

### Place the raw input data

Download the raw data from [this link](https://drive.google.com/file/d/1Xl2e0LoJmg6rBMmKOkc_9ktDw4dIZIxj/view?usp=drive_link) and unzip it. The folder must be named `input` and placed inside `malaria-igh-lookout/preprocess/`.

The expected folder structure is:

```
preprocess/
└── input/
    ├── information_for_report.csv
    ├── MIS/
    ├── publication/
    │   └── *.csv
    └── sequencing/
        └── 2021/
            ├── *.json
            └── *.csv
```

Here's a summary of each data type and where it lives:

| Data type | Location | Filename requirement |
|---|---|---|
| Drug resistance (publications) | `input/publication/` | `.csv` files |
| HRP2/3 deletion (publications) | `input/publication/` | must be named `hrp_deletion.csv` |
| Drug resistance (sequencing) | `input/sequencing/2021/` | `.tsv` files |
| HRP2/3 deletion (sequencing) | `input/sequencing/2021/` | must be named `hrp2_3_deletion_20XX.csv` |
| Alert level info | `input/` | must be named `information_for_report.csv` |
| Plasmodium species info | `input/sequencing/2021/` | must be named `speciation_summary.csv` |
| Malaria infection prevalence (MIS) | `input/MIS/` | must be named `positive_YEAR.csv`|

> File names matter. The processing script looks for specific names, so renaming a file will cause it to be skipped.

### Add or update the data

#### Publication data

To add new publication data entries:
- Append new rows to the relevant gene's `.csv` file
- Also append the relevant information to `all_publication_information.csv`
- Do not change the column headers

#### Sequencing data

Sequencing data is organized by year inside `preprocess/input/sequencing/`. To add data for a new year (e.g. 2022), create a new folder at the same level as `2021/` with this structure:

```
sequencing/
└── 2022/
    ├── drugs/
    │   ├── *.json
    │   └── *.csv
    ├── hrp2_3_deletion.csv
    └── speciation_summary.csv
```

The script will automatically extract MOI data from all `*_summary.json` files, and drug/diagnostic resistance mutation data from all `.csv` files in the folder.

#### Malaria infection prevalence (MIS data)

Add a `.csv` file to `preprocess/input/MIS/` following the naming convention `positive_YEAR.csv`, where `YEAR` is the four-digit year.


### Run the transformation script

With all data in place, run:

```bash
./transform.py
```

This script processes the raw input and writes to two locations:

| Output location | Contents | Purpose |
|---|---|---|
| `preprocess/output/` | Intermediate `.csv` files | More readable; useful for sanity-checking results |
| `site/data/` | Final `.json` files | Consumed by the dashboard |


Now, go back to your browser at **http://localhost:9200/** and refresh the page. If changes are not showing up,clear your browser cache or open the page in a private/incognito window. Browsers sometimes serve a cached version of the data.

---

## Updating the Site Layout

The dashboard layout is configured through two JSON files: `site.json` and `single.json`. Documentation on how to edit these is available at:
[https://lookout.sentinel.network/docs/configure/](https://lookout.sentinel.network/docs/configure/)


#test for update