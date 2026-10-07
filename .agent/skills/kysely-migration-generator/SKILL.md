---
name: kysely-migration-generator
description: Consumes a Mermaid ERD to translate into a type-safe Kysely database migration
---

# ERD Generator Skill

This skill allows the agent to turn Mermai ERD's into a Kysely database migration directly, while following strict guardrails/constraints to ensure low errors/

## Workflow

Follow these guardrails exactly, do not skip any:

1. Map mermaid entities to snake_case table names (eg. USERS->users)
2. Convert PK attributes to auto-generating IDs/UUIDs and FK attributes to ".references().onDelete('cascade')"
3. Correctly map "||--o{" (one to many) and "||--o|" (one to one wiht unique constraints)
4. Write the generated TypeScript migration to "src/db/migrations/<timestamp>_<migration_name>.ts"
5. Enforce exports for both "up(db: Kysely<any>)" and "down(db: Kysely<any>)" functions. The down function must drop tables in reverse dependsy order.
