#!/usr/bin/env python3
"""Read-only checks for numbered static-ad deliverables; no semantic QA claims."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

from PIL import Image


def validate(root, ids, min_width, min_height):
    errors, records = [], []
    ledger = root / "台帳.md"
    ledger_text = ledger.read_text(encoding="utf-8") if ledger.is_file() else ""
    if not ledger_text.strip():
        errors.append("台帳.md: missing or empty")
    targets = {
        unquote(m.group(1).strip("<>" )).split("#", 1)[0]
        for m in re.finditer(r"\]\(([^\n]+?)\)", ledger_text)
    }
    for number in ids:
        folder = root / number
        expected = {f"{number}-image.png", "ヘッドライン.txt", "本文.txt"}
        actual = {p.name for p in folder.iterdir()} if folder.is_dir() else set()
        if actual != expected:
            errors.append(f"{number}: expected only {sorted(expected)}, found {sorted(actual)}")
        for filename in sorted(expected):
            path = folder / filename
            if not path.is_file():
                errors.append(f"{number}/{filename}: missing file")
                continue
            if not any((root / target).resolve() == path.resolve() for target in targets):
                errors.append(f"{number}/{filename}: missing relative link in 台帳.md")
            if filename.endswith(".txt"):
                try:
                    value = path.read_text(encoding="utf-8")
                    if not value.strip():
                        errors.append(f"{number}/{filename}: empty text")
                    if "\x00" in value or "\ufffd" in value:
                        errors.append(f"{number}/{filename}: NUL or replacement character")
                except UnicodeDecodeError:
                    errors.append(f"{number}/{filename}: invalid UTF-8")
            else:
                try:
                    with Image.open(path) as img:
                        fmt, width, height = img.format, img.width, img.height
                        img.verify()
                    with Image.open(path) as img:
                        img.load()
                    if fmt != "PNG":
                        errors.append(f"{number}/{filename}: actual format {fmt}, expected PNG")
                    if width < min_width or height < min_height:
                        errors.append(f"{number}/{filename}: {width}x{height} below {min_width}x{min_height}")
                    records.append({"id": number, "width": width, "height": height,
                                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
                except (OSError, ValueError, SyntaxError) as exc:
                    errors.append(f"{number}/{filename}: unreadable image ({exc})")
        materials = root / "_制作資料" / number
        if not materials.is_dir() or not any(p.is_file() for p in materials.rglob("*")):
            errors.append(f"_制作資料/{number}: missing or no source/production records")
    return {"ok": not errors, "scope": "files only; visual/copy/claims/publishing QA is separate",
            "checked_ids": ids, "images": records, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="brand's 広告/Static Ads directory")
    parser.add_argument("--ids", nargs="+", help="numbers to check, e.g. 01 02")
    parser.add_argument("--min-width", type=int, default=1)
    parser.add_argument("--min-height", type=int, default=1)
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error("root must be an existing directory")
    if args.min_width < 1 or args.min_height < 1:
        parser.error("minimum dimensions must be positive")
    ids = args.ids or sorted(p.name for p in args.root.iterdir()
                             if p.is_dir() and re.fullmatch(r"[0-9]{2,}", p.name))
    if not ids or any(not re.fullmatch(r"[0-9]{2,}", n) for n in ids):
        parser.error("provide at least one numeric folder ID of two or more digits")
    result = validate(args.root.resolve(), list(dict.fromkeys(ids)), args.min_width, args.min_height)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
