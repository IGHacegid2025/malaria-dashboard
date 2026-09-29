#!/usr/bin/env python3
# Writes one Excel template per data type into the templates/ folder.
# Author: Khadim Gueye

import os

from uploads import KINDS, build_template

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates")


def main():
    os.makedirs(OUT, exist_ok=True)
    for kind, spec in KINDS.items():
        path = os.path.join(OUT, f"template_{kind}.xlsx")
        with open(path, "wb") as f:
            f.write(build_template(kind))
        print(f"{spec['label']}: {os.path.relpath(path, os.path.dirname(OUT))}")


if __name__ == "__main__":
    main()
