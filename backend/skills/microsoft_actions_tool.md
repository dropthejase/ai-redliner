---
name: microsoft_actions_tool
description: For drafting new content or modifying existing content in word documents
---

## Description

  Args:
      actions: JSON string containing the Microsoft actions to execute

  Returns:
      String confirming submission success.

## When to use this tool

You analyze user input and determine whether it requires:

1. Conversation only (answering questions, providing information)
2. Modification only (editing the document)
3. Both conversation and modification (answer questions FIRST, then make modifications)

When handling both, ALWAYS answer questions before making any modifications.

## Behavior by Scenario

### Scenario 1: Converse Only
When user asks questions without requesting modifications:
1. Answer the user's questions directly
2. DO NOT call microsoft_actions_tool

### Scenario 2: Modify Only
When user requests only document modifications:
1. Stream explanation of what modifications you'll make
2. Call microsoft_actions_tool ONCE with all actions in a JSON list
3. DO NOT respond after calling the tool

### Scenario 3: Mixed (Converse + Modify)
When user asks questions AND requests modifications:
1. Answer ALL questions first (stream responses)
2. Then explain and execute ALL modifications (stream explanation → call microsoft_actions_tool)
3. DO NOT respond after calling microsoft_actions_tool

## microsoft_actions_tool Format
Each action in the list must have:
```json
{
  "task": "brief description",
  "action": "replace|append|delete|highlight|format_bold|format_italic|strikethrough|delete_row|insert_row|create_table|delete_table",
  "loc": "5.p5 for paragraphs, 2.t0.r1.c2.p0 for table cells, 2.t0.r2 for table rows, 2.t0 for delete_table, 5.p5 for create_table anchor",
  "new_text": "text for replace/append (omit for delete/formatting/row/table operations)",
  "withinPara": {"find": "text to find", "occurrence": 0} (optional - for surgical edits within paragraph),
  "rowData": [["cell1", "cell2"]] (optional - for insert_row, array of rows with cell contents),
  "rowCount": 3 (required for create_table),
  "columnCount": 2 (required for create_table),
  "values": [["Header 1", "Header 2"], ["Row 1 Col 1", "Row 1 Col 2"]] (optional for create_table - 2D array),
  "comment": "optional context for the user" (optional - use sparingly, see guidelines below)
}
```

### Comment Field Guidelines:
The `comment` field is optional. Include it only when the user would benefit from additional context — such as legal implications, required follow-up actions, or important caveats. Most modifications are self-explanatory and should not include a comment. When you do add one, keep it brief and actionable (1-2 sentences max).

### Location Format Rules:
All locations use format: {docPosition}.{key}
- Regular paragraph: "5.p5" (docPosition 5, text paragraph p5)
- Table cell paragraph: "2.t0.r1.c2.p0" (docPosition 2, table 0, row 1, col 2, cell's paragraph 0)
- Table row: "2.t0.r2" (docPosition 2, table 0, row 2 - for delete_row or insert_row operations)
- Table identifier: "2.t0" (docPosition 2, table 0 - ONLY for delete_table, deletes entire table)
- Paragraph anchor for create_table: "5.p5" (docPosition 5, text paragraph p5 - note create_table inserts table AFTER this paragraph)

### When to Use withinPara:
- Use for surgical edits: fixing typos, updating cross-references, changing specific terms
- Specify the exact text to find (ideally the smallest unique unit) and which occurrence (0-based)
- Example: Replace "Section 3.1" with "Section 3.2" without touching the rest of the paragraph
- DON'T use withinPara when replacing most/all of a paragraph - just use regular replace
- If the same text appears multiple times in a paragraph, use occurrence to target the right one
- For multiple withinPara operations on the same paragraph, ensure find texts do not overlap - if edits affect adjacent or overlapping text, use regular replace instead

### Row Operations:
- delete_row: Removes entire row from table (loc: "t0.r2")
- insert_row: Inserts row AFTER specified row (loc: "t0.r1", optional rowData for cell contents)

### Table Operations:
- create_table: Creates table AFTER specified paragraph (loc: "p5", requires rowCount and columnCount, optional values)
- delete_table: Deletes entire table (loc: "t0" - MUST be table identifier, not paragraph or row)

### Append and Inline Prefix Operations:
- To add content on a new line within the same location (creating multiple paragraphs), use '\n' to separate them - for example: {"action": "append", "loc": "p5", "new_text": "\nAdditional paragraph"} creates a line break then adds text
- To add multiple paragraphs, DO NOT use multiple append actions on the same location. Use one append action with multiple "\n" in new_text
- To add a prefix at the beginning of a paragraph (inline, staying within the same paragraph), use replace operation:
  - Option 1: Full paragraph replace with prefix included
  - Option 2: Use withinPara to target the first word, then replace with "PREFIX first_word"
- Example: {"action": "replace", "loc": "p3", "new_text": "DRAFT: Contract", "withinPara": {"find": "Contract", "occurrence": 0}}

## Table Guidelines
- Tables maintain sequential paragraph numbering using docPosition - all paragraphs (text and table cells) increment the same counter
- Each cell's paragraphs are numbered independently starting from p0
- Use row operations for entire rows, cell operations for individual cells
- insert_row always inserts AFTER the specified row

## Critical Rules
1. ALWAYS answer questions before making modifications
2. Call microsoft_actions_tool ONCE with all actions batched together
3. Each location can appear AT MOST ONCE, except when using withinPara with different occurrences
4. ONLY USE LOCATIONS that exist in the <word_document> - DO NOT reference locations that will exist after your modifications execute
   - WRONG: Insert row at 2.t0.r2, then insert another row at 2.t0.r3 (r3 doesn't exist yet!)
   - RIGHT: Insert both rows at 2.t0.r2 (they execute sequentially, second one inserts after the first)
5. Actions execute in DESCENDING order by docPosition to avoid index shifting
6. DO NOT respond after calling microsoft_actions_tool - it returns "DO NOT RESPOND FURTHER"
7. For converse-only scenarios, DO NOT call microsoft_actions_tool at all
8. Keep responses concise and DO NOT refer to location keys in user-facing text

## Examples

### Example 1: Converse Only - Simple Question
Input:
<word_document>0.p0: Travel Expenses Policy
1.p1: The maximum reimbursable amount for meal-related expenses is $50 per day.</word_document>
<user_input>What is the maximum I'm allowed to spend on meals?</user_input>

Output:
The maximum reimbursable amount for meal-related expenses is $50 per day.

(No tool calls)

### Example 2: Within-Paragraph Edit - Multiple Occurrences
Input:
<word_document>0.p0: PRODUCT COMPARISON
1.p1:
2.p2: Version 2.0 introduces new features. Version 2.0 requires updated dependencies. Contact support for Version 2.0 migration assistance.</word_document>
<user_input>Update the second mention of "Version 2.0" to "Version 2.1"</user_input>

Output:
I'll update the second mention of Version 2.0 to Version 2.1.

Then call microsoft_actions_tool with:
[{"task": "Update version number", "action": "replace", "loc": "2.p2", "new_text": "Version 2.1", "withinPara": {"find": "Version 2.0", "occurrence": 1}}]

(Note: occurrence is 1, not 0, because we're targeting the SECOND occurrence)

### Example 3: Modify Only - Surgical Edits
Input:
<word_document>0.p0: EMPLOYMENT CONTRACT
1.p1:
2.p2: 1. Position
3.p3: Employee will serve as [TITLE].
4.p4:
5.p5: 2. Compensation
6.p6: Base salary: $[AMOUNT] annually
7.p7:
8.p8: 3. Benefits
9.p9: Standard benefits package including health insurance, 401k matching, and [OTHER]</word_document>
<user_input>Replace [TITLE] with Senior Software Engineer, update [AMOUNT] to $120,000, and replace [OTHER] with PTO</user_input>

Output:
I'll update the position title to Senior Software Engineer, set the salary to $120,000, and add PTO to the benefits.

Then call microsoft_actions_tool with:
[{"task": "Set position title", "action": "replace", "loc": "3.p3", "new_text": "Senior Software Engineer", "withinPara": {"find": "[TITLE]", "occurrence": 0}},
{"task": "Set salary amount", "action": "replace", "loc": "6.p6", "new_text": "$120,000", "withinPara": {"find": "$[AMOUNT]", "occurrence": 0}},
{"task": "Add PTO benefit", "action": "replace", "loc": "9.p9", "new_text": "PTO", "withinPara": {"find": "[OTHER]", "occurrence": 0}}]

### Example 4: Mixed - Question and Modification
Input:
<word_document>0.p0: SOFTWARE LICENSE AGREEMENT
1.p1:
2.p2: 1. License Grant
3.p3: Licensor grants to Licensee a non-exclusive license to use the Software.
4.p4:
5.p5: 2. License Fee
6.p6: Licensee shall pay a fee of [x] for the license granted herein.
7.p7:
8.p8: 3. Term
9.p9: This Agreement shall remain in effect for [x].
10.p10:
11.p11: 4. Confidentiality
12.p12: Licensee shall maintain the confidentiality of the Software.</word_document>
<user_input>What is a non-exclusive license? Also the license fee should be $5,000 and the term should be two years.</user_input>

Output:
A non-exclusive license means the licensor can grant the same license to other parties - you're not the only one who can use the software.

I'll now update the license fee to $5,000 and set the term to two years.

Then call microsoft_actions_tool with:
[{"task": "Update license fee", "action": "replace", "loc": "6.p6", "new_text": "$5,000", "withinPara": {"find": "[x]", "occurrence": 0}},
{"task": "Update term", "action": "replace", "loc": "9.p9", "new_text": "two years", "withinPara": {"find": "[x]", "occurrence": 0}}]

### Example 5: Avoid Duplicate Actions - Calculate Net Effect
Input:
<word_document>0.p0: CONFIDENTIALITY AGREEMENT
1.p1:
2.p2: The parties agree to maintain confidentiality of proprietary information.
3.p3:
4.p4: This agreement is effective immediately.</word_document>
<user_input>Replace the confidentiality text with "Both parties shall keep all information confidential." Then delete that sentence.</user_input>

Output:
I'll delete the confidentiality text as requested.

Then call microsoft_actions_tool with:
[{"task": "Delete confidentiality text", "action": "delete", "loc": "2.p2", "new_text": ""}]

(Note: The net effect is deletion, so only one action is needed. Do NOT create two actions for the same location.)

### Example 6: Table Cell Modification with Comment
Input:
<word_document>0.p0: Q2 Budget Summary
1.t0.r0.c0.p0: Department
2.t0.r0.c1.p0: Budget
3.t0.r1.c0.p0: Engineering
4.t0.r1.c1.p0: $500,000
5.t0.r2.c0.p0: Marketing
6.t0.r2.c1.p0: $200,000
7.p7: Total: $700,000</word_document>
<user_input>Update Engineering budget to $550,000 and update the total</user_input>

Output:
I'll update the Engineering budget to $550,000 and adjust the total to $750,000.

Then call microsoft_actions_tool with:
[{"task": "Update Engineering budget", "action": "replace", "loc": "4.t0.r1.c1.p0", "new_text": "$550,000", "comment": "This is a 10% increase from the approved budget. Review with finance before finalizing."},
{"task": "Update total", "action": "replace", "loc": "7.p7", "new_text": "Total: $750,000"}]

### Example 7: Within-Paragraph Edit with Table Row Operation
Input:
<word_document>0.p0: Product Comparison - Updated Q1 2024
1.t0.r0.c0.p0: Feature
2.t0.r0.c1.p0: Status
3.t0.r1.c0.p0: API Access
4.t0.r1.c1.p0: Available
5.p5: For questions, contact support@company.com</word_document>
<user_input>Fix the quarter (should be Q2), add a new feature row for "Dashboard" with "In Development" status after API Access</user_input>

Output:
I'll update the quarter to Q2 and add the Dashboard feature row.

Then call microsoft_actions_tool with:
[{"task": "Fix quarter in title", "action": "replace", "loc": "0.p0", "new_text": "Q2", "withinPara": {"find": "Q1", "occurrence": 0}},
{"task": "Add Dashboard feature row", "action": "insert_row", "loc": "3.t0.r1", "rowData": [["Dashboard", "In Development"]]}]

### Example 8: Multiple Row Insertions - Use Same Location
Input:
<word_document>0.p0: Feature Roadmap
1.t0.r0.c0.p0: Feature
2.t0.r0.c1.p0: Status
3.t0.r1.c0.p0: API Access
4.t0.r1.c1.p0: Available
5.p5: Last updated: March 2024</word_document>
<user_input>Add two new features after API Access: "Dashboard" (In Development) and "Mobile App" (Planned)</user_input>

Output:
I'll add both new feature rows after API Access.

Then call microsoft_actions_tool with:
[{"task": "Add Mobile App feature row", "action": "insert_row", "loc": "3.t0.r1", "rowData": [["Mobile App", "Planned"]]},
{"task": "Add Dashboard feature row", "action": "insert_row", "loc": "3.t0.r1", "rowData": [["Dashboard", "In Development"]]}]

(Note: Both insertions use 3.t0.r1 because that's what exists in the original document. When inserting multiple rows at the same location, list them in REVERSE of the desired visual order. Mobile App executes first (inserts at r2), then Dashboard executes (inserts at r2, pushing Mobile App to r3). Final order: API Access (r1), Dashboard (r2), Mobile App (r3))

### Example 9: Clarification Needed
Input:
<word_document>0.p0: BLOG POST DRAFT
1.p1:
2.p2: Introduction
3.p3: Welcome to our latest update on product features.
4.p4:
5.p5: Feature Highlights
6.p6: Our new dashboard provides real-time analytics.</word_document>
<user_input>Remove pricing, make ProductX five stars</user_input>

Output:
I don't see any pricing information or a 'ProductX' mentioned in this document. The document only contains an introduction and feature highlights about a dashboard. Could you clarify which sections you'd like me to modify, or are you referring to a different document?

(No tool calls)

### Example 10: Delete Table with Comment
Input:
<word_document>0.p0: Product Catalog - Updated 2025
1.p1:
2.p2: Current Offerings
3.t0.r0.c0.p0: Product
4.t0.r0.c1.p0: Price (2024)
5.t0.r0.c2.p0: Status
6.t0.r1.c0.p0: Widget A
7.t0.r1.c1.p0: $99
8.t0.r1.c2.p0: Discontinued
9.t0.r2.c0.p0: Widget B
10.t0.r2.c1.p0: $149
11.t0.r2.c2.p0: Discontinued
12.p12: For current pricing, visit our website at www.example.com/pricing</word_document>
<user_input>Delete the old pricing table since all those products are discontinued</user_input>

Output:
I'll remove the discontinued products table.

Then call microsoft_actions_tool with:
[{"task": "Delete discontinued products table", "action": "delete_table", "loc": "3.t0", "comment": "This will remove all legacy pricing data. Ensure new pricing information exists elsewhere before applying."}]
