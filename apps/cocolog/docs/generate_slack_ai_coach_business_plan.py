from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape


BASE_DIR = Path(__file__).resolve().parent
SOURCE_PATH = BASE_DIR / "slack-ai-coach-business-plan.md"
OUTPUT_PATH = BASE_DIR / "SlackコミュニケーションAIコーチ_事業計画書.docx"


def iter_blocks(lines: list[str]) -> list[dict]:
    blocks: list[dict] = []
    i = 0

    while i < len(lines):
        line = lines[i].rstrip("\n")

        if not line.strip():
            i += 1
            continue

        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1
            blocks.append({"type": "table", "lines": table_lines})
            continue

        if line.startswith("# "):
            blocks.append({"type": "heading", "level": 1, "text": line[2:].strip()})
        elif line.startswith("## "):
            blocks.append({"type": "heading", "level": 2, "text": line[3:].strip()})
        elif line.startswith("### "):
            blocks.append({"type": "heading", "level": 3, "text": line[4:].strip()})
        elif line.startswith("- "):
            blocks.append({"type": "bullet", "text": line[2:].strip()})
        else:
            blocks.append({"type": "paragraph", "text": line.strip()})

        i += 1

    return blocks


def parse_table(lines: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for idx, line in enumerate(lines):
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if idx == 1 and all(set(cell) <= {"-", " "} for cell in cells):
            continue
        rows.append(cells)
    return rows


def xml_paragraph(text: str, style: str | None = None, bullet: bool = False) -> str:
    style_xml = f"<w:pStyle w:val=\"{style}\"/>" if style else ""
    bullet_xml = (
        "<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr>" if bullet else ""
    )
    return (
        "<w:p>"
        f"<w:pPr>{style_xml}{bullet_xml}</w:pPr>"
        "<w:r><w:rPr><w:lang w:eastAsia=\"ja-JP\"/></w:rPr>"
        f"<w:t xml:space=\"preserve\">{escape(text)}</w:t></w:r>"
        "</w:p>"
    )


def xml_table(rows: list[list[str]]) -> str:
    if not rows:
        return ""

    col_count = max(len(row) for row in rows)
    col_width = 9000 // max(col_count, 1)

    grid = "".join(f"<w:gridCol w:w=\"{col_width}\"/>" for _ in range(col_count))
    table_rows = []

    for row_index, row in enumerate(rows):
        cells_xml = []
        padded = row + [""] * (col_count - len(row))
        for cell in padded:
            shading = (
                "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"EAF1FB\"/>"
                if row_index == 0
                else ""
            )
            cells_xml.append(
                "<w:tc>"
                f"<w:tcPr><w:tcW w:w=\"{col_width}\" w:type=\"dxa\"/>{shading}</w:tcPr>"
                "<w:p><w:r><w:rPr><w:lang w:eastAsia=\"ja-JP\"/></w:rPr>"
                f"<w:t xml:space=\"preserve\">{escape(cell)}</w:t></w:r></w:p>"
                "</w:tc>"
            )
        table_rows.append("<w:tr>" + "".join(cells_xml) + "</w:tr>")

    return (
        "<w:tbl>"
        "<w:tblPr>"
        "<w:tblStyle w:val=\"TableGrid\"/>"
        "<w:tblW w:w=\"0\" w:type=\"auto\"/>"
        "<w:tblBorders>"
        "<w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"A0A0A0\"/>"
        "<w:left w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"A0A0A0\"/>"
        "<w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"A0A0A0\"/>"
        "<w:right w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"A0A0A0\"/>"
        "<w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D9D9D9\"/>"
        "<w:insideV w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"D9D9D9\"/>"
        "</w:tblBorders>"
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
        + "".join(table_rows)
        + "</w:tbl>"
    )


def document_xml(blocks: list[dict]) -> str:
    body_parts: list[str] = []
    for block in blocks:
        if block["type"] == "heading":
            style = {1: "Title", 2: "Heading1", 3: "Heading2"}[block["level"]]
            body_parts.append(xml_paragraph(block["text"], style=style))
        elif block["type"] == "bullet":
            body_parts.append(xml_paragraph(block["text"], bullet=True))
        elif block["type"] == "paragraph":
            body_parts.append(xml_paragraph(block["text"]))
        elif block["type"] == "table":
            body_parts.append(xml_table(parse_table(block["lines"])))

    body_parts.append(
        "<w:sectPr>"
        "<w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/>"
        "</w:sectPr>"
    )

    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document "
        "xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        + "".join(body_parts)
        + "</w:body></w:document>"
    )


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:eastAsia="Hiragino Sans" w:cs="Helvetica"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="ja-JP" w:eastAsia="ja-JP" w:bidi="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="120" w:line="320" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="120" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="180" w:after="90"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>
"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""


def rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""


def document_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>
"""


def core_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>SlackコミュニケーションAIコーチ 事業計画書</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-03-14T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-03-14T00:00:00Z</dcterms:modified>
</cp:coreProperties>
"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
"""


def numbering_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>
"""


def write_docx() -> None:
    lines = SOURCE_PATH.read_text(encoding="utf-8").splitlines()
    blocks = iter_blocks(lines)

    with ZipFile(OUTPUT_PATH, "w", compression=ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml())
        docx.writestr("_rels/.rels", rels_xml())
        docx.writestr("docProps/core.xml", core_xml())
        docx.writestr("docProps/app.xml", app_xml())
        docx.writestr("word/document.xml", document_xml(blocks))
        docx.writestr("word/styles.xml", styles_xml())
        docx.writestr("word/numbering.xml", numbering_xml())
        docx.writestr("word/_rels/document.xml.rels", document_rels_xml())


if __name__ == "__main__":
    write_docx()
    print(OUTPUT_PATH)
