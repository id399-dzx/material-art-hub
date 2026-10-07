#!/usr/bin/env python3
"""Publish the supplied MATLAB source as UTF-8 text without executing it.

Only .m files are copied. Data, images, and encrypted P-code stay local.
"""

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


DEFAULT_ARCHIVE = Path("/Users/xingye/Desktop/L1502/Matlab论文绘图代码/Matlab论文插图绘制模板.zip")
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "l1502-matlab"
EXTERNAL_FUNCTIONS = ("TheColor", "addcolorplus", "addcolor")


def decode_text(raw):
    for encoding in ("utf-8-sig", "gb18030"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("MATLAB source has an unsupported text encoding")


def data_files(source):
    """Identify file arguments, not load's trailing variable names."""
    references = set()
    for line in source.splitlines():
        line = line.lstrip()
        if line.startswith("%"):
            continue
        command = re.search(r"\bload\s+(?!\()([^\s;,%]+)", line)
        if command:
            filename = command.group(1).strip("'\"")
            if re.fullmatch(r"[\w.\-]+", filename):
                references.add(filename if Path(filename).suffix else f"{filename}.mat")
        for call in re.finditer(r"\b(?:load|readtable|readmatrix|xlsread|importdata|imread)\s*\(\s*['\"]([^'\"]+)['\"]", line):
            references.add(call.group(1))
        # MATLAB's bundled example referenced via fullfile rather than a literal path.
        if re.search(r"\breadtable\s*\(\s*fullfile", line):
            references.update(re.findall(r"['\"]([^'\"]+\.(?:csv|xlsx?|mat|txt))['\"]", line, re.I))
    return sorted(references)


def generate(archive):
    issues = {}
    with zipfile.ZipFile(archive) as bundle:
        for entry in bundle.infolist():
            name = entry.filename if entry.flag_bits & 0x800 else entry.filename.encode("cp437").decode("gb18030")
            parts = Path(name).parts
            if "__MACOSX" in parts or not name.lower().endswith(".m"):
                continue
            if len(parts) != 2 or not re.fullmatch(r"[A-Za-z0-9_]+\.m", parts[-1]):
                raise ValueError(f"Unexpected MATLAB source path: {name}")
            match = re.search(r"第(\d+)期", parts[0])
            if not match:
                raise ValueError(f"Missing issue number: {name}")
            issue = int(match.group(1))
            source = decode_text(bundle.read(entry))
            record = issues.setdefault(issue, {"issue": issue, "folder": parts[0], "scripts": []})
            if record["folder"] != parts[0]:
                raise ValueError(f"Multiple source folders for issue {issue}")
            is_helper = bool(re.match(r"\s*(?:%[^\n]*\n\s*)*function\b", source))
            functions = [function for function in EXTERNAL_FUNCTIONS if re.search(rf"\b{function}\s*\(", source)]
            path = f"/l1502-matlab/{issue:03d}/{parts[-1]}"
            target = OUTPUT / f"{issue:03d}" / parts[-1]
            target.parent.mkdir(parents=True, exist_ok=True)
            encoded = source.encode("utf-8")
            target.write_bytes(encoded)
            record["scripts"].append({
                "name": parts[-1], "path": path,
                "role": "helper" if is_helper else "plot",
                "lines": len(source.splitlines()), "bytes": len(encoded),
                "sha256": hashlib.sha256(encoded).hexdigest(),
                "dataFiles": data_files(source), "externalFunctions": functions,
            })
    if set(issues) != set(range(1, 140)):
        raise ValueError("The source archive must contain every issue from 1 to 139")
    count = sum(len(record["scripts"]) for record in issues.values())
    if count != 143:
        raise ValueError(f"Expected 143 scripts, found {count}")
    for issue, record in sorted(issues.items()):
        record["scripts"].sort(key=lambda script: (script["role"] == "helper", script["name"].casefold()))
        (OUTPUT / f"{issue:03d}" / "metadata.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {count} UTF-8 MATLAB scripts for {len(issues)} issues; no source was executed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", nargs="?", type=Path, default=DEFAULT_ARCHIVE)
    generate(parser.parse_args().archive)
