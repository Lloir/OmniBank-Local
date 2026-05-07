"""
migrate_budgets_v2.py
---------------------
Migration SQLite : système de budgets v1 → v2

- Renomme budgets.category_name → budgets.name
- Ajoute budgets.is_project, budgets.is_closed
- Crée la table budget_categories
- Migre les données existantes (1 catégorie → 1 entrée dans budget_categories)
- Ajoute la colonne transactions.budget_id

Usage:
    python migrations/migrate_budgets_v2.py
"""
import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'omnibank.db')

def run():
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] DB not found at {DB_PATH}")
        sys.exit(1)

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    print("=== Budget v2 Migration ===")

    # ── 1. Check if already migrated ──────────────────────────────────────────
    cur.execute("PRAGMA table_info(budgets)")
    cols = [row[1] for row in cur.fetchall()]
    already_migrated = 'name' in cols and 'is_project' in cols

    if already_migrated:
        print("[SKIP] budgets table already at v2 schema.")
    else:
        print("[STEP 1] Migrating budgets table...")

        # Read existing data
        cur.execute("SELECT id, category_name, monthly_amount, period FROM budgets")
        old_budgets = cur.fetchall()
        print(f"  Found {len(old_budgets)} existing budgets to migrate.")

        # Recreate budgets table with new schema
        cur.executescript("""
            DROP TABLE IF EXISTS budgets_old;
            ALTER TABLE budgets RENAME TO budgets_old;

            CREATE TABLE budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                monthly_amount REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                is_project INTEGER DEFAULT 0,
                is_closed INTEGER DEFAULT 0
            );
        """)

        # Insert migrated rows
        for (bid, cat_name, amount, period) in old_budgets:
            cur.execute(
                "INSERT INTO budgets (id, name, monthly_amount, period, is_project, is_closed) VALUES (?,?,?,?,0,0)",
                (bid, cat_name, amount, period or 'monthly')
            )

        con.commit()
        print(f"  [OK] {len(old_budgets)} budgets migrated.")

        # Drop old table
        cur.execute("DROP TABLE IF EXISTS budgets_old")
        con.commit()

    # ── 2. Create budget_categories table ─────────────────────────────────────
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budget_categories'")
    if cur.fetchone():
        print("[SKIP] budget_categories table already exists.")
    else:
        print("[STEP 2] Creating budget_categories table...")
        cur.execute("""
            CREATE TABLE budget_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                budget_id INTEGER NOT NULL REFERENCES budgets(id),
                category_name TEXT NOT NULL
            )
        """)
        con.commit()

        # Migrate: for each budget that has the same name as a category,
        # create a budget_category entry (category_name = budget.name)
        cur.execute("SELECT id, name FROM budgets WHERE is_project = 0")
        for (bid, bname) in cur.fetchall():
            # Check if the name matches a known category
            cur2 = con.cursor()
            cur2.execute("SELECT name FROM categories WHERE name = ?", (bname,))
            cat = cur2.fetchone()
            if cat:
                cur.execute(
                    "INSERT INTO budget_categories (budget_id, category_name) VALUES (?,?)",
                    (bid, bname)
                )
        con.commit()
        print("  [OK] budget_categories populated from existing budgets.")

    # ── 3. Add budget_id column to transactions ────────────────────────────────
    cur.execute("PRAGMA table_info(transactions)")
    tx_cols = [row[1] for row in cur.fetchall()]
    if 'budget_id' in tx_cols:
        print("[SKIP] transactions.budget_id already exists.")
    else:
        print("[STEP 3] Adding budget_id to transactions...")
        cur.execute("ALTER TABLE transactions ADD COLUMN budget_id INTEGER REFERENCES budgets(id)")
        con.commit()
        print("  [OK] Done.")

    con.close()
    print("\n=== Migration complete [OK] ===")

if __name__ == '__main__':
    run()
