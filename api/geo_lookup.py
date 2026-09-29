#!/usr/bin/env python3
# IP geolocation from the free DB-IP lite databases (https://db-ip.com, CC BY 4.0).
# Build once: python geo_lookup.py build geo/dbip-city-lite.csv.gz
# Author: Khadim Gueye

import csv
import gzip
import ipaddress
import mmap
import os
import socket
import struct
import sys
import threading

GEO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
FAMILIES = {4: (socket.AF_INET, 4), 6: (socket.AF_INET6, 16)}

_lock = threading.Lock()
_maps = None


def _path(name):
    return os.path.join(GEO_DIR, name)


def build(source):
    locations, index = [], {}
    out = {4: open(_path("ipv4.bin.tmp"), "wb"), 6: open(_path("ipv6.bin.tmp"), "wb")}
    last = {4: None, 6: None}
    opener = gzip.open if source.endswith(".gz") else open
    with opener(source, "rt", encoding="utf-8", newline="") as fh:
        for row in csv.reader(fh):
            if len(row) < 3:
                continue
            start = row[0]
            family = 6 if ":" in start else 4
            country = row[3] if len(row) >= 8 else row[2]
            if len(row) >= 8:
                key = (country, row[4], row[5], row[6], row[7])
            else:
                key = (country, "", "", "", "")
            loc = index.get(key)
            if loc is None:
                loc = index[key] = len(locations)
                locations.append(key)
            if last[family] == loc:
                continue
            last[family] = loc
            out[family].write(socket.inet_pton(FAMILIES[family][0], start) + struct.pack(">I", loc))
    for fh in out.values():
        fh.close()
    offsets = []
    with open(_path("locations.txt.tmp"), "wb") as fh:
        for key in locations:
            offsets.append(fh.tell())
            fh.write(("\t".join(key) + "\n").encode("utf-8"))
    with open(_path("locations.idx.tmp"), "wb") as fh:
        fh.write(struct.pack(f">{len(offsets)}I", *offsets))
    for name in ("ipv4.bin", "ipv6.bin", "locations.txt", "locations.idx"):
        os.replace(_path(name + ".tmp"), _path(name))
    global _maps
    _maps = None
    return len(locations)


def _open():
    global _maps
    with _lock:
        if _maps is None:
            maps = {}
            try:
                for name in ("ipv4.bin", "ipv6.bin", "locations.txt", "locations.idx"):
                    with open(_path(name), "rb") as fh:
                        maps[name] = mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ)
            except (OSError, ValueError):
                maps = {}
            _maps = maps
    return _maps


def available():
    return bool(_open())


def _search(data, key, width):
    size = width + 4
    lo, hi = 0, len(data) // size
    while lo < hi:
        mid = (lo + hi) // 2
        if data[mid * size: mid * size + width] <= key:
            lo = mid + 1
        else:
            hi = mid
    if lo == 0:
        return None
    return struct.unpack(">I", data[(lo - 1) * size + width: lo * size])[0]


def _location(maps, loc):
    idx = maps["locations.idx"]
    start = struct.unpack(">I", idx[loc * 4: loc * 4 + 4])[0]
    text = maps["locations.txt"]
    end = text.find(b"\n", start)
    country, region, city, lat, lon = text[start:end].decode("utf-8").split("\t")
    return country, region, city, lat, lon


def lookup(ip):
    empty = {"country_code": None, "region": None, "city": None, "latitude": None, "longitude": None}
    try:
        addr = ipaddress.ip_address((ip or "").strip())
    except ValueError:
        return empty
    if addr.version == 6 and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
        return {**empty, "country_code": "LOCAL"}
    maps = _open()
    if not maps:
        return empty
    width = FAMILIES[addr.version][1]
    loc = _search(maps[f"ipv{addr.version}.bin"], addr.packed, width)
    if loc is None:
        return empty
    country, region, city, lat, lon = _location(maps, loc)
    if country in ("", "ZZ"):
        return empty
    located = bool(city) and (lat, lon) != ("0", "0")
    return {
        "country_code": country,
        "region": region or None,
        "city": city or None,
        "latitude": float(lat) if located else None,
        "longitude": float(lon) if located else None,
    }


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "build":
        print(f"{build(sys.argv[2])} locations written to {GEO_DIR}")
    elif len(sys.argv) == 2:
        print(lookup(sys.argv[1]))
    else:
        print("usage: geo_lookup.py build <dbip-city-lite.csv.gz> | geo_lookup.py <ip>")
