# Microsoft Actions Reference

Complete guide to document edits supported by Redliner's agent.

---

## Quick Reference

| Action | Requires `new_text` | Requires `rowData` | Target | Description |
| --- | --- | --- | --- | --- |
| `replace` | ✅ | ❌ | Paragraph or text span | Replace entire paragraph or specific text within |
| `append` | ✅ | ❌ | Paragraph | Add text to end of paragraph |
| `delete` | ❌ | ❌ | Paragraph | Remove paragraph entirely |
| `highlight` | ❌ | ❌ | Paragraph | Apply yellow highlight |
| `format_bold` | ❌ | ❌ | Paragraph | Apply bold formatting |
| `format_italic` | ❌ | ❌ | Paragraph | Apply italic formatting |
| `strikethrough` | ❌ | ❌ | Paragraph | Apply strikethrough formatting |
| `delete_table` | ❌ | ❌ | Entire table | Remove entire table from document |
| `delete_row` | ❌ | ❌ | Table row | Remove entire row from table |
| `insert_row` | ❌ | ✅ | Table row | Insert new row(s) after specified row |
| `create_table` | ❌ | ❌ | Paragraph anchor | Create new table after specified paragraph |

---

## JSON Format

Every action must include:

```json
{
  "task": "Brief description shown to user",
  "action": "replace | append | delete | highlight | format_bold | format_italic | strikethrough | delete_row | insert_row",
  "loc": "p0 | p12 | t0.r1.c0.p0 | t0.r2"
}
```

Optional fields:
- `new_text` (string): Required for `replace`, `append`. Omitted for others.
- `rowData` (array): Required for `insert_row`. Format: `[["cell1", "cell2"], ["cell3", "cell4"]]`
- `withinPara` (object): Optional for `replace` to target specific text. Format: `{"find": "text to find", "occurrence": 0}`

---

## Location Syntax

### Regular Paragraphs

Format: `p{index}`

Examples:
- `p0` — first paragraph in document
- `p5` — sixth paragraph (0-indexed)
- `p12` — thirteenth paragraph

Paragraph numbers are **global document positions**, counting from the start of the document.

### Table Cells

Format: `t{table}.r{row}.c{col}.p{para}`

Examples:
- `t0.r0.c0.p0` — first paragraph in top-left cell of first table
- `t1.r2.c1.p0` — first paragraph in third row, second column of second table
- `t0.r0.c0.p1` — second paragraph in same cell (cells can have multiple paragraphs)

**How tables affect paragraph numbering:**

```text
p0: Text before table
t0: [Table starts — occupies positions 1-4 for cells]
t0.r0.c0.p0: Header cell 1
t0.r0.c1.p0: Header cell 2
t0.r1.c0.p0: Data cell 1
t0.r1.c1.p0: Data cell 2
p5: Text after table (next available paragraph position)
```

Table cells "consume" paragraph indices — `p5` comes after `p0` because the table occupied `p1-p4`.

### Table Rows

Format: `t{table}.r{row}`

Examples:
- `t0.r0` — first row of first table
- `t1.r2` — third row of second table

Used only for `delete_row` and `insert_row` actions.

---

## Content Edits

### Replace Entire Paragraph

```json
{
  "task": "Update document title",
  "action": "replace",
  "loc": "p0",
  "new_text": "Confidentiality Agreement — Revised 2025"
}
```

Replaces the full text of paragraph `p0`.

### Replace Specific Text (Within-Paragraph Edit)

```json
{
  "task": "Correct cross-reference",
  "action": "replace",
  "loc": "p5",
  "new_text": "Section 3.2",
  "withinPara": {
    "find": "Section 3.1",
    "occurrence": 0
  }
}
```

Finds the first occurrence (`occurrence: 0`) of `"Section 3.1"` in paragraph `p5` and replaces it with `"Section 3.2"`. The rest of the paragraph stays unchanged.

**Occurrence numbering:**
- `0` = first match
- `1` = second match
- `2` = third match, etc.

If the text isn't found or `occurrence` exceeds available matches, the action fails silently.

### Append Text

```json
{
  "task": "Add effective date",
  "action": "append",
  "loc": "p15",
  "new_text": "\n\nEffective Date: [INSERT DATE]"
}
```

Adds text to the **end** of paragraph `p15`. Use `\n` for line breaks within the paragraph.

### Delete Paragraph

```json
{
  "task": "Remove obsolete clause",
  "action": "delete",
  "loc": "p8"
}
```

Deletes paragraph `p8` entirely. No `new_text` needed.

---

## Formatting Actions

All formatting actions apply to the **entire paragraph**. No `new_text` required.

### Highlight

```json
{
  "task": "Flag vague term for review",
  "action": "highlight",
  "loc": "p5"
}
```

Applies yellow highlight to paragraph `p5`.

### Bold

```json
{
  "task": "Emphasize key term",
  "action": "format_bold",
  "loc": "p3"
}
```

Applies bold formatting to paragraph `p3`.

### Italic

```json
{
  "task": "Style legal citation",
  "action": "format_italic",
  "loc": "p7"
}
```

Applies italic formatting to paragraph `p7`.

### Strikethrough

```json
{
  "task": "Mark obsolete clause for deletion",
  "action": "strikethrough",
  "loc": "p12"
}
```

Applies strikethrough formatting to paragraph `p12`.

---

## Table Operations

### Delete Row

```json
{
  "task": "Remove outdated data row",
  "action": "delete_row",
  "loc": "t0.r2"
}
```

Deletes row 2 (third row) from table `t0`. All cells in that row are removed.

### Insert Row

```json
{
  "task": "Add missing row after header",
  "action": "insert_row",
  "loc": "t0.r0",
  "rowData": [
    ["New cell 1", "New cell 2", "New cell 3"]
  ]
}
```

Inserts a new row **after** row 0 (the header row) in table `t0`. The `rowData` array contains one row with three cells.

**Multi-row insertion:**

```json
{
  "task": "Add two data rows",
  "action": "insert_row",
  "loc": "t0.r1",
  "rowData": [
    ["Row 2 Cell 1", "Row 2 Cell 2"],
    ["Row 3 Cell 1", "Row 3 Cell 2"]
  ]
}
```

Inserts two rows after row 1. Each inner array is one row.

**Important:**
- Each row in `rowData` must have the same number of cells as the table columns
- Rows are inserted **after** the specified `loc` row
- If `rowData` is missing or malformed, the action fails

### Edit Table Cells

Use `replace`, `append`, `delete` with table cell locations:

```json
{
  "task": "Update cell value",
  "action": "replace",
  "loc": "t0.r1.c0.p0",
  "new_text": "Updated data"
}
```

Replaces the first paragraph in row 1, column 0 of table `t0`.

---

## Multi-Action Examples

### Mixed Content and Formatting

```json
{
  "modifications": [
    {
      "task": "Update title",
      "action": "replace",
      "loc": "p0",
      "new_text": "Employment Agreement — Revised"
    },
    {
      "task": "Highlight ambiguous term",
      "action": "highlight",
      "loc": "p5"
    },
    {
      "task": "Remove obsolete clause",
      "action": "delete",
      "loc": "p8"
    },
    {
      "task": "Emphasize key section",
      "action": "format_bold",
      "loc": "p12"
    }
  ]
}
```

### Table Restructuring

```json
{
  "modifications": [
    {
      "task": "Remove empty row",
      "action": "delete_row",
      "loc": "t0.r3"
    },
    {
      "task": "Add new data rows",
      "action": "insert_row",
      "loc": "t0.r1",
      "rowData": [
        ["2024-Q1", "$150,000"],
        ["2024-Q2", "$175,000"]
      ]
    },
    {
      "task": "Update header",
      "action": "replace",
      "loc": "t0.r0.c0.p0",
      "new_text": "Quarter"
    }
  ]
}
```

---

## Execution Order

When multiple actions target the same document:

1. **Sorted descending by paragraph index** — highest `p{n}` first
2. **Applied atomically** — all checked actions execute in one batch with change tracking on

This prevents index shifting. Example:

```json
[
  {"action": "delete", "loc": "p8"},
  {"action": "replace", "loc": "p3"},
  {"action": "append", "loc": "p1"}
]
```

Execution order: `p8` → `p3` → `p1`. If `p1` ran first, `p3` and `p8` would shift down.

---

## Edge Cases

### Within-Paragraph on Multi-Line Text

`withinPara` searches the **full paragraph text** including line breaks. Example:

```text
Paragraph: "This is line one.\nThis is line two."
Find: "line two"
Result: ✅ Found (searches across line breaks)
```

### Table Cell with Multiple Paragraphs

```text
t0.r0.c0.p0: "First paragraph in cell"
t0.r0.c0.p1: "Second paragraph in same cell"
```

To edit the second paragraph, use `loc: "t0.r0.c0.p1"`.

### Invalid Locations

If the agent specifies a `loc` that doesn't exist:
- Frontend shows error: "Paragraph not found"
- Action is rejected automatically
- Other actions in the batch still execute

### Empty `new_text`

For `replace` and `append` actions, `new_text` can be an empty string (`""`). This effectively deletes content (for `replace`) or does nothing (for `append`).

---

## Limitations

- **No cross-paragraph operations**: Each action targets exactly one paragraph, cell, row, or table
- **No undo via agent**: Once applied, changes are Word tracked changes — user must accept/reject via Word's Review tab
- **Formatting is paragraph-level**: Cannot bold just one word (use `withinPara` to isolate the word in a separate edit)
- **No image/shape operations**: Agent cannot insert, modify, or delete images, shapes, or drawings
- **No header/footer edits**: Actions only target main document body

---

## How the Agent Sees Your Document

Before sending your message, the frontend extracts the document structure:

```text
<word_document>
p0: Employment Agreement
p1: This Agreement is entered into on [DATE] between...
p2: 1. Position and Duties
t0: [Table]
t0.r0.c0.p0: Effective Date
t0.r0.c1.p0: Salary
t0.r1.c0.p0: January 1, 2025
t0.r1.c1.p0: $120,000
p7: 2. Compensation
p8: Employee shall receive...
</word_document>
```

The agent references these `loc` identifiers in its actions. This mapping is recomputed on every user message and checked again before applying actions (to catch stale edits if the user manually changed the doc).

---

## See Also

- [Office.js Word API Reference](https://learn.microsoft.com/en-us/javascript/api/word)
- [Strands Agent SDK Tool Use](https://docs.strands.ai/)
- Main README: [README.md](../../README.md)
