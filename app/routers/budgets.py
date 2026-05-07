from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract
from pydantic import BaseModel
from datetime import date
from typing import Optional, List
import json

from app.database import get_db
from app.models import Budget, BudgetCategory, Transaction, GlobalConfig

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    name: str
    monthly_amount: float
    period: Optional[str] = "monthly"
    is_project: Optional[bool] = False
    categories: Optional[List[str]] = []

class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    monthly_amount: Optional[float] = None
    period: Optional[str] = None
    is_project: Optional[bool] = None
    is_closed: Optional[bool] = None
    categories: Optional[List[str]] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _budget_to_dict(b: Budget, db: Session) -> dict:
    cats = db.query(BudgetCategory).filter(BudgetCategory.budget_id == b.id).all()
    return {
        "id": b.id,
        "name": b.name,
        "monthly_amount": b.monthly_amount,
        "period": b.period,
        "is_project": b.is_project,
        "is_closed": b.is_closed,
        "categories": [c.category_name for c in cats],
    }


# ─── CRUD endpoints ───────────────────────────────────────────────────────────

@router.get("/")
def get_budgets(db: Session = Depends(get_db)):
    budgets = db.query(Budget).order_by(Budget.name).all()
    return [_budget_to_dict(b, db) for b in budgets]


@router.post("/")
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    b = Budget(
        name=data.name,
        monthly_amount=data.monthly_amount,
        period=data.period,
        is_project=data.is_project,
        is_closed=False,
    )
    db.add(b)
    db.commit()
    db.refresh(b)

    for cat_name in (data.categories or []):
        db.add(BudgetCategory(budget_id=b.id, category_name=cat_name))
    db.commit()

    return _budget_to_dict(b, db)


@router.put("/{budget_id}")
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget non trouvé.")

    for k, v in data.dict(exclude_unset=True).items():
        if k == "categories":
            continue  # handled below
        setattr(b, k, v)

    if data.categories is not None:
        db.query(BudgetCategory).filter(BudgetCategory.budget_id == budget_id).delete()
        for cat_name in data.categories:
            db.add(BudgetCategory(budget_id=budget_id, category_name=cat_name))

    db.commit()
    db.refresh(b)
    return _budget_to_dict(b, db)


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget non trouvé.")
    db.query(BudgetCategory).filter(BudgetCategory.budget_id == budget_id).delete()
    db.delete(b)
    db.commit()
    return {"ok": True}


# ─── Status endpoint ──────────────────────────────────────────────────────────

@router.get("/status")
def get_budget_status(year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Returns spending vs budget for each envelope."""
    today = date.today()
    y = year or today.year
    m = month or today.month

    budgets = db.query(Budget).filter(Budget.is_closed == False).all()
    result = []

    for b in budgets:
        cats = [c.category_name for c in db.query(BudgetCategory).filter(BudgetCategory.budget_id == b.id).all()]

        expenses = 0.0
        income = 0.0

        if b.is_project:
            txs = db.query(Transaction).filter(Transaction.budget_id == b.id).all()
            for tx in txs:
                if tx.type == "Recettes":
                    income += abs(tx.amount)
                else:
                    expenses += abs(tx.amount)
        elif b.period == "indefinite":
            txs_all = db.query(Transaction).filter(
                Transaction.type.in_(["Dépenses fixes", "Dépenses variables", "Recettes"]),
            ).all()
            for tx in txs_all:
                if cats and (tx.category or "Sans catégorie") not in cats:
                    continue
                if tx.type == "Recettes":
                    income += abs(tx.amount)
                else:
                    expenses += abs(tx.amount)
        else:
            txs = db.query(Transaction).filter(
                extract('year', Transaction.date_operation) == y,
                extract('month', Transaction.date_operation) == m,
                Transaction.type.in_(["Dépenses fixes", "Dépenses variables", "Recettes"]),
            ).all()
            for tx in txs:
                if cats and (tx.category or "Sans catégorie") not in cats:
                    continue
                if tx.type == "Recettes":
                    income += abs(tx.amount)
                else:
                    expenses += abs(tx.amount)

        expenses = round(expenses, 2)
        income = round(income, 2)
        spent = round(expenses - income, 2)  # net: can be negative if income > expenses

        budget_amount = (
            b.monthly_amount if b.period == "monthly"
            else round(b.monthly_amount / 12, 2) if b.period == "yearly"
            else b.monthly_amount
        )
        pct = round((max(spent, 0) / budget_amount * 100) if budget_amount > 0 else 0, 1)

        result.append({
            "id": b.id,
            "name": b.name,
            "categories": cats,
            "is_project": b.is_project,
            "is_closed": b.is_closed,
            "budget_amount": budget_amount,
            "expenses": expenses,
            "income": income,
            "spent": max(spent, 0),    # display: never negative
            "net": spent,              # raw net value
            "remaining": round(budget_amount - spent, 2),
            "percent": pct,
            "period": b.period,
        })

    return {"year": y, "month": m, "budgets": result}


# ─── Budget transactions detail ───────────────────────────────────────────────

@router.get("/{budget_id}/transactions")
def get_budget_transactions(budget_id: int, year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Return all transactions contributing to a budget envelope."""
    from datetime import date as _date
    today = _date.today()
    y = year or today.year
    m = month or today.month

    b = db.query(Budget).filter(Budget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget non trouvé.")

    cats = [c.category_name for c in db.query(BudgetCategory).filter(BudgetCategory.budget_id == budget_id).all()]

    if b.is_project:
        txs = db.query(Transaction).filter(Transaction.budget_id == budget_id)\
            .order_by(Transaction.date_operation.desc()).all()
    elif b.period == "indefinite":
        q = db.query(Transaction).filter(
            Transaction.type.in_(["Dépenses fixes", "Dépenses variables", "Recettes"]),
        )
        if cats:
            q = q.filter(Transaction.category.in_(cats))
        txs = q.order_by(Transaction.date_operation.desc()).all()
    else:
        q = db.query(Transaction).filter(
            extract('year', Transaction.date_operation) == y,
            extract('month', Transaction.date_operation) == m,
            Transaction.type.in_(["Dépenses fixes", "Dépenses variables", "Recettes"]),
        )
        if cats:
            q = q.filter(Transaction.category.in_(cats))
        txs = q.order_by(Transaction.date_operation.desc()).all()

    return [{
        "id": tx.id,
        "date": tx.date_operation.isoformat(),
        "description": tx.description,
        "amount": tx.amount,
        "type": tx.type,
        "category": tx.category,
        "is_income": tx.type == "Recettes",
    } for tx in txs]


# ─── AI Suggestion endpoint ───────────────────────────────────────────────────

@router.post("/ai_suggest")
def ai_suggest_budgets(db: Session = Depends(get_db)):
    """
    Analyse the last 3 months of spending per category and asks Ollama
    to suggest logical budget envelopes with amounts.
    Returns a list of proposals [{name, categories, suggested_amount}].
    """
    from app.routers.chat import get_ollama_config, call_ollama_sync

    cfg = get_ollama_config(db)
    if not cfg.get("enabled"):
        raise HTTPException(status_code=400, detail="IA non activée dans les paramètres.")

    today = date.today()

    # Compute monthly averages over last 3 months
    monthly_totals: dict[str, list[float]] = {}
    for delta in range(1, 4):
        m = today.month - delta
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        txs = db.query(Transaction).filter(
            extract('year', Transaction.date_operation) == y,
            extract('month', Transaction.date_operation) == m,
            Transaction.type.in_(["Dépenses fixes", "Dépenses variables"]),
        ).all()

        for tx in txs:
            cat = tx.category or "Sans catégorie"
            monthly_totals.setdefault(cat, []).append(tx.amount)

    if not monthly_totals:
        raise HTTPException(status_code=400, detail="Pas assez de données pour une suggestion.")

    # Build averages
    averages = {cat: round(sum(vals) / len(vals), 2) for cat, vals in monthly_totals.items()}
    avg_lines = "\n".join(f"- {cat}: {amt:.2f}€/mois" % () if False else f"- {cat}: {amt:.2f}€/mois" for cat, amt in sorted(averages.items(), key=lambda x: -x[1]))

    prompt = f"""Tu es un conseiller financier. Voici les dépenses moyennes mensuelles de l'utilisateur sur les 3 derniers mois, par catégorie :

{avg_lines}

Propose des enveloppes budgétaires logiques. Regroupe les catégories similaires si pertinent.
Pour chaque enveloppe, réponds UNIQUEMENT en JSON valide, un objet par ligne, avec ce format exact :
{{"name": "Nom de l'enveloppe", "categories": ["Cat1", "Cat2"], "suggested_amount": 250.00, "reason": "Explication courte"}}

Ne réponds rien d'autre que les lignes JSON. Pas de markdown, pas de texte autour."""

    raw = call_ollama_sync(prompt, cfg)

    proposals = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                obj = json.loads(line)
                # Validate required fields
                if "name" in obj and "suggested_amount" in obj:
                    proposals.append({
                        "name": obj["name"],
                        "categories": obj.get("categories", []),
                        "suggested_amount": float(obj["suggested_amount"]),
                        "reason": obj.get("reason", ""),
                    })
            except Exception:
                pass

    if not proposals:
        raise HTTPException(status_code=500, detail="L'IA n'a pas pu générer de propositions valides.")

    return {"proposals": proposals}
