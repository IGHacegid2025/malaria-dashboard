# Population genomics results: gene flow networks per year
# Author: Khadim Gueye

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

import gene_flow
from security import audit, client_ip, current_user, super_admin

router = APIRouter()

MAX_BYTES = 30 * 1024 * 1024


def _year(year: int):
    if year < 1990 or year > 2100:
        raise HTTPException(400, "Invalid year")
    return year


@router.get("/api/genomics/gene-flow/years")
def gene_flow_years():
    return gene_flow.available_years()


@router.get("/api/genomics/gene-flow/{year}")
def gene_flow_network(year: int):
    if _year(year) not in gene_flow.available_years():
        raise HTTPException(404, f"No gene flow analysis for {year}")
    try:
        return {"year": year, **gene_flow.network_for_year(year)}
    except ValueError as err:
        raise HTTPException(500, str(err))


@router.get("/api/admin/genomics/gene-flow")
def admin_gene_flow(user=Depends(current_user)):
    rows = []
    if os.path.isdir(gene_flow.DATA_DIR):
        for name in sorted(os.listdir(gene_flow.DATA_DIR), reverse=True):
            if not name.isdigit() or len(name) != 4:
                continue
            folder = os.path.join(gene_flow.DATA_DIR, name)
            tree, meta = gene_flow._paths(int(name))
            row = {"year": int(name), "hidden": os.path.exists(os.path.join(folder, ".hidden")), "ready": False}
            if os.path.isfile(tree) and os.path.isfile(meta):
                try:
                    net = gene_flow.network_for_year(int(name))
                    row.update(ready=True, samples=net["matched_tips"], tips=net["tips"], states=len(net["nodes"]),
                               links=len(net["links"]), transitions=net["transitions"],
                               updated=max(os.path.getmtime(tree), os.path.getmtime(meta)))
                except (ValueError, OSError) as err:
                    row["error"] = str(err)
            rows.append(row)
    return rows


async def _read(file: UploadFile, label):
    content = await file.read()
    if not content:
        raise HTTPException(400, f"The {label} file is empty")
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"The {label} file is larger than 30 MB")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, f"The {label} file must be a text file (UTF-8)")


@router.post("/api/admin/genomics/gene-flow")
async def upload_gene_flow(
    request: Request,
    year: int = Form(...),
    tree: UploadFile = File(...),
    metadata: UploadFile = File(...),
    user=Depends(current_user),
):
    _year(year)
    tree_text = await _read(tree, "tree")
    meta_text = await _read(metadata, "metadata")
    try:
        net = gene_flow.build_network(tree_text, meta_text)
    except (ValueError, IndexError) as err:
        raise HTTPException(400, str(err))
    folder = os.path.join(gene_flow.DATA_DIR, str(year))
    os.makedirs(folder, exist_ok=True)
    tree_path, meta_path = gene_flow._paths(year)
    for path, text in ((tree_path, tree_text), (meta_path, meta_text)):
        with open(path + ".tmp", "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        os.replace(path + ".tmp", path)
    hidden = os.path.join(folder, ".hidden")
    if os.path.exists(hidden):
        os.remove(hidden)
    summary = {"year": year, "samples": net["matched_tips"], "tips": net["tips"], "states": len(net["nodes"]),
               "links": len(net["links"]), "tree": tree.filename, "metadata": metadata.filename}
    audit(user, "gene_flow_uploaded", "gene_flow", year, summary, client_ip(request))
    return summary


@router.post("/api/admin/genomics/gene-flow/{year}/hide")
def hide_gene_flow(year: int, request: Request, user=Depends(current_user)):
    folder = os.path.join(gene_flow.DATA_DIR, str(_year(year)))
    if not os.path.isdir(folder):
        raise HTTPException(404, "Year not found")
    open(os.path.join(folder, ".hidden"), "w").close()
    audit(user, "gene_flow_hidden", "gene_flow", year, None, client_ip(request))
    return {"ok": True}


@router.post("/api/admin/genomics/gene-flow/{year}/restore")
def restore_gene_flow(year: int, request: Request, user=Depends(super_admin)):
    hidden = os.path.join(gene_flow.DATA_DIR, str(_year(year)), ".hidden")
    if os.path.exists(hidden):
        os.remove(hidden)
    audit(user, "gene_flow_restored", "gene_flow", year, None, client_ip(request))
    return {"ok": True}
