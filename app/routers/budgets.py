from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from app.database import get_db
from app.models import Budget, Transaction

router = APIRouter(prefix="/api/budgets", tags=["budgets"])

class BudgetCreate(BaseModel):
    category_name: str
    monthly_amount: float
    period: Optional[str] = "monthly"

class BudgetUpdate(BaseModel):
    monthly_amount: Optional[float] = None
    period: Optional[str] = None

@router.get("/")
def get_budgets(db: Session = Depends(get_db)):
    return db.query(Budget).order_by(Budget.category_name).all()

@router.post("/")
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    existing = db.query(Budget).filter(Budget.category_name == data.category_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Budget pour cette catégorie déjà existant.")
    b = Budget(**data.dict())
    db.add(b)
    db.commit()
    db.refresh(b)
    return b

@router.put("/{budget_id}")
def update_budget(budget_id: int, data: BudgetUpdate, db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget non trouvé.")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(b, k, v)
    db.commit()
    db.refresh(b)
    return b

@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget non trouvé.")
    db.delete(b)
    db.commit()
    return {"ok": True}

@router.get("/status")
def get_budget_status(year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Returns spending vs budget for each category for the given month."""
    today = date.today()
    y = year or today.year
    m = month or today.month

    # All expense transactions for the month
    from sqlalchemy import extract
    txs = db.query(Transaction).filter(
        extract('year', Transaction.date_operation) == y,
        extract('month', Transaction.date_operation) == m,
        Transaction.type.in_(["Dépenses fixes", "Dépenses variables"])
    ).all()

    spent_by_cat = {}
    for tx in txs:
        cat = tx.category or "Sans catégorie"
        spent_by_cat[cat] = round(spent_by_cat.get(cat, 0.0) + tx.amount, 2)

    budgets = db.query(Budget).all()
    result = []
    for b in budgets:
        spent = spent_by_cat.get(b.category_name, 0.0)
        budget_amount = b.monthly_amount if b.period == "monthly" else round(b.monthly_amount / 12, 2)
        pct = round((spent / budget_amount * 100) if budget_amount > 0 else 0, 1)
        result.append({
            "id": b.id,
            "category_name": b.category_name,
            "budget_amount": budget_amount,
            "spent": spent,
            "remaining": round(budget_amount - spent, 2),
            "percent": pct,
            "period": b.period
        })

    return {"year": y, "month": m, "budgets": result}
