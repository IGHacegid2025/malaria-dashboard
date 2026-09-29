# Gene flow networks between states, built like StrainHub:
# parsimony (Fitch) reconstruction of the state on the phylogeny, then every
# state change along a branch is counted as a directed gene flow link.
# Author: Khadim Gueye

import csv
import io
import os
import re
from collections import Counter, deque
from functools import lru_cache

import config  # noqa: F401

DATA_DIR = os.environ.get(
    "GENE_FLOW_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data_analysis", "gene_flow"),
)
TREE_FILE = "strainhub_tree.treefile"
META_FILE = "strainhub_metadata.csv"


class Node:
    __slots__ = ("name", "children", "states", "state")

    def __init__(self, name=""):
        self.name = name
        self.children = []
        self.states = None
        self.state = None


def parse_newick(text):
    text = text.strip()
    if not text.endswith(";"):
        text += ";"
    tokens = re.findall(r"'[^']*'|[(),:;]|[^(),:;]+", text)
    root = Node()
    stack = [root]
    current = root
    expect_length = False
    for tok in tokens:
        if tok == "(":
            child = Node()
            current.children.append(child)
            stack.append(child)
            current = child
            expect_length = False
        elif tok == ",":
            stack.pop()
            parent = stack[-1]
            child = Node()
            parent.children.append(child)
            stack.append(child)
            current = child
            expect_length = False
        elif tok == ")":
            stack.pop()
            current = stack[-1]
            expect_length = False
        elif tok == ":":
            expect_length = True
        elif tok == ";":
            break
        elif expect_length:
            expect_length = False
        else:
            current.name = tok.strip().strip("'")
    if len(stack) != 1:
        raise ValueError("The tree file is not a valid Newick tree")
    return root


def iter_postorder(root):
    out, stack = [], [root]
    while stack:
        node = stack.pop()
        out.append(node)
        stack.extend(node.children)
    return reversed(out)


def read_metadata(text):
    reader = csv.DictReader(io.StringIO(text.lstrip("﻿")))
    fields = {f.strip().lower(): f for f in reader.fieldnames or []}
    id_col = next((fields[k] for k in ("accession", "id", "sample", "sample_id", "name", "taxa") if k in fields), None)
    state_col = next((fields[k] for k in ("state", "location", "region", "country") if k in fields), None)
    if not id_col or not state_col:
        raise ValueError("The metadata needs an 'Accession' (sample id) column and a 'state' column")
    states = {}
    for row in reader:
        sid = (row.get(id_col) or "").strip()
        state = (row.get(state_col) or "").strip()
        if sid and state:
            states[sid] = " ".join(w.capitalize() if w.islower() else w for w in state.split())
    return states


def reconstruct(root, tip_states):
    frequency = Counter(tip_states.values())
    order = sorted(frequency, key=lambda s: (-frequency[s], s))
    rank = {s: i for i, s in enumerate(order)}
    everything = frozenset(order)
    matched = 0
    for node in iter_postorder(root):
        if not node.children:
            state = tip_states.get(node.name)
            if state:
                matched += 1
            node.states = frozenset([state]) if state else everything
            continue
        sets = [c.states for c in node.children]
        common = frozenset.intersection(*sets)
        node.states = common if common else frozenset.union(*sets)
    pick = lambda options: min(options, key=rank.__getitem__)
    root.state = pick(root.states)
    links = Counter()
    queue = deque([root])
    while queue:
        node = queue.popleft()
        for child in node.children:
            child.state = node.state if node.state in child.states else pick(child.states)
            if child.state != node.state:
                links[(node.state, child.state)] += 1
            queue.append(child)
    return links, matched


def shortest_paths(nodes, adjacency, source):
    dist = {source: 0}
    sigma = dict.fromkeys(nodes, 0)
    sigma[source] = 1
    preds = {n: [] for n in nodes}
    order = []
    queue = deque([source])
    while queue:
        v = queue.popleft()
        order.append(v)
        for w in adjacency[v]:
            if w not in dist:
                dist[w] = dist[v] + 1
                queue.append(w)
            if dist[w] == dist[v] + 1:
                sigma[w] += sigma[v]
                preds[w].append(v)
    return dist, sigma, preds, order


def centrality(nodes, links):
    adjacency = {n: sorted({b for (a, b) in links if a == n}) for n in nodes}
    between = dict.fromkeys(nodes, 0.0)
    closeness = {}
    n = len(nodes)
    for s in nodes:
        dist, sigma, preds, order = shortest_paths(nodes, adjacency, s)
        delta = dict.fromkeys(nodes, 0.0)
        for w in reversed(order):
            for v in preds[w]:
                delta[v] += sigma[v] / sigma[w] * (1 + delta[w])
            if w != s:
                between[w] += delta[w]
        reached = len(dist) - 1
        total = sum(dist.values())
        closeness[s] = (reached / total) * (reached / (n - 1)) if total and n > 1 else 0.0
    return between, closeness


def build_network(tree_text, metadata_text):
    tip_states = read_metadata(metadata_text)
    root = parse_newick(tree_text)
    tips = [node for node in iter_postorder(root) if not node.children]
    links, matched = reconstruct(root, tip_states)
    if not matched:
        raise ValueError("No sample name of the tree matches the metadata 'Accession' column")
    samples = Counter(tip_states[t.name] for t in tips if t.name in tip_states)
    nodes = sorted(set(samples) | {a for a, _ in links} | {b for _, b in links})
    between, closeness = centrality(nodes, links)
    out_links = Counter(a for a, _ in links)
    in_links = Counter(b for _, b in links)
    out_flow = Counter()
    in_flow = Counter()
    for (a, b), w in links.items():
        out_flow[a] += w
        in_flow[b] += w
    node_rows = []
    for name in nodes:
        degree = out_links[name] + in_links[name]
        node_rows.append({
            "id": name,
            "samples": samples[name],
            "outdegree": out_links[name],
            "indegree": in_links[name],
            "out_flow": out_flow[name],
            "in_flow": in_flow[name],
            "betweenness": round(between[name], 3),
            "closeness": round(closeness[name], 4),
            "source_hub_ratio": round(out_links[name] / degree, 3) if degree else 0.0,
        })
    return {
        "nodes": node_rows,
        "links": [{"source": a, "target": b, "weight": w} for (a, b), w in sorted(links.items(), key=lambda x: -x[1])],
        "tips": len(tips),
        "matched_tips": matched,
        "transitions": sum(links.values()),
        "method": "Parsimony (Fitch) on the state of each sample, as in StrainHub",
    }


def available_years():
    if not os.path.isdir(DATA_DIR):
        return []
    years = []
    for name in os.listdir(DATA_DIR):
        folder = os.path.join(DATA_DIR, name)
        if re.fullmatch(r"\d{4}", name) and os.path.isfile(os.path.join(folder, TREE_FILE)) and os.path.isfile(os.path.join(folder, META_FILE)):
            if not os.path.exists(os.path.join(folder, ".hidden")):
                years.append(int(name))
    return sorted(years)


def _paths(year):
    folder = os.path.join(DATA_DIR, str(int(year)))
    return os.path.join(folder, TREE_FILE), os.path.join(folder, META_FILE)


@lru_cache(maxsize=32)
def _cached(year, stamp):
    tree, meta = _paths(year)
    with open(tree, encoding="utf-8") as t, open(meta, encoding="utf-8-sig") as m:
        return build_network(t.read(), m.read())


def network_for_year(year):
    tree, meta = _paths(year)
    stamp = (os.path.getmtime(tree), os.path.getmtime(meta))
    return _cached(int(year), stamp)


if __name__ == "__main__":
    import sys

    result = network_for_year(int(sys.argv[1]) if len(sys.argv) > 1 else 2021)
    print(f"tips {result['tips']}, matched {result['matched_tips']}, transitions {result['transitions']}, "
          f"states {len(result['nodes'])}, links {len(result['links'])}")
    for row in sorted(result["nodes"], key=lambda r: -r["outdegree"])[:8]:
        print(row)
    print(result["links"][:6])
