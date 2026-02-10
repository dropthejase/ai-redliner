# Microsoft Actions Features TODO

### Table-Aware Context

Redliner represents Word tables explicitly in the document context sent to the agent:

```text
p0: Introduction text
t0: [Table]
t0.r0.c0.p0: Header cell 1
t0.r0.c1.p0: Header cell 2
t0.r1.c0.p0: Data cell 1
t0.r1.c1.p0: Data cell 2
p5: Text after table
```

**Paragraph Numbering:** Regular paragraphs are numbered by their global position in the document. In the example above, `p0` is at position 0, the table cells occupy positions 1-4, so `p5` is the next paragraph at position 5.

**Cell Paragraphs:** The `p` in `t{n}.r{r}.c{c}.p{p}` represents the paragraph index within that specific cell (starting from 0 for each cell).

This allows the agent to:

- Understand table structure
- Modify specific cells
- Insert or delete entire rows
- Apply formatting to table content

### Within-Paragraph Edits

The agent can target specific text within paragraphs instead of replacing entire paragraphs:

```json
{
  "action": "replace",
  "loc": "p5",
  "new_text": "Section 3.2",
  "withinPara": {
    "find": "Section 3.1",
    "occurrence": 0
  }
}
```

This enables surgical edits like:

- Correcting cross-references
- Updating specific terms
- Formatting individual words or phrases

### Row-Level Operations

The agent can insert or delete entire table rows:

```json
{
  "task": "Remove obsolete data",
  "action": "delete_row",
  "loc": "t0.r2"
}

{
  "task": "Add missing row after header",
  "action": "insert_row",
  "loc": "t0.r0",
  "rowData": [["New cell 1", "New cell 2"]]
}
```