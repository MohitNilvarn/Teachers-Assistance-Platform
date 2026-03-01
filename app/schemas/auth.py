from pydantic import BaseModel, EmailStr
from typing import Optional

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str  # "student" or "teacher"
    year: Optional[str] = None  # "FE", "SE", "TE", "BE"
    subject_code: Optional[str] = None  # For teachers — selected subject code

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: str