from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import Category
from app.schemas.api_schemas import CategoryBase, CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])

@router.get("/", response_model=List[CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.type, Category.name).all()

@router.post("/", response_model=CategoryOut)
def create_category(cat: CategoryBase, db: Session = Depends(get_db)):
    db_cat = db.query(Category).filter(Category.name == cat.name).first()
    if db_cat:
        raise HTTPException(status_code=400, detail="Category already exists")
    new_cat = Category(**cat.dict())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    db_cat = db.query(Category).filter(Category.id == cat_id).first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(db_cat)
    db.commit()
    return {"ok": True}
