---
name: erd-generator
description: Generates, validates, and renders Entity-Relationship Diagrams (ERD) using Mermaid and Mermaid CLI. Trigger when requested to design a database schema, ERD, data model, or architecture diagram.
---

# ERD Generator Skill

This skill enables the agent to design and validate Entity-Relationship Diagrams (ERDs) in Mermaid format, compile them deterministically to SVG using the local Mermaid CLI binary, and self-heal any syntax errors.

## Workflow

Follow this workflow excatly, do not skip steps

1. Parse domain requirements into entities, primary keys, foreign keys, and cardinalities
2. Write the drafted Mermaid syntax directly to docs/architecture/schema.mmd
3. Execute node script/render_erd.js docs/architecture/schema.mmd
4. Self Correction Loops:
  If execution fails with SYNTAX_ERROR, parse the error trace, adjust Mermaid syntax in docs/architecture/schema.mmd, and re-run (max 3 times)
5. Final output:
  Present the raw Mermaid block to the user and reference the generated image asset path (docs/arhitecture/erd.svg)
