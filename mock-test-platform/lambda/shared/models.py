"""
SQLAlchemy models.

Global schema: questions, exams, subjects, exam_question_map, exam_categories, exam_boards, exam_patterns
Tenant schema: results, users, user_settings, checkpoints, student_enrollment, weakness_snapshot

Rules:
- DB stores only: qid, v, scope, langs, yt, offline (everything else from QID or R2) [!]
- Tenant schema stores qid reference only; never question content [!]
- Questions/subjects/exams in global schema only; never duplicated per tenant [!]
"""

from sqlalchemy import (
    Column, String, Integer, SmallInteger, Boolean, Text, ARRAY,
    Float, DateTime, JSON, BigInteger, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime


class Base(DeclarativeBase):
    pass


# ─── Global Schema ────────────────────────────────────────────────────────────

class Subject(Base):
    """subject_master — topic + subtopic hierarchy"""
    __tablename__ = "subjects"

    subject = Column(String(8), primary_key=True)   # MATH, PHY, CHEM ...
    topic_id = Column(Integer, primary_key=True)
    subtopic_id = Column(Integer, primary_key=True)
    topic_name = Column(String(128), nullable=False)
    subtopic_name = Column(String(128), nullable=False)
    class_levels = Column(ARRAY(Integer))            # e.g. [9, 10, 11, 12]
    exam_cats = Column(ARRAY(String(1)))             # S, I, C, D, B, A


class Question(Base):
    """
    ~80 bytes per row.
    QID encodes: subject+topic+subtopic+type+difficulty+exam_cat
    Content: r2://global/q/{qid}.json (loaded on question open)
    Solution: r2://global/sol/{qid}.json (loaded after submit)
    """
    __tablename__ = "questions"

    qid = Column(String(32), primary_key=True)      # MATH-03-02-S-M-C-000123
    v = Column(SmallInteger, nullable=False)         # version
    scope = Column(String(1), nullable=False)        # O=open R=restricted
    langs = Column(ARRAY(String(5)), nullable=False) # ["en","hi","te"]
    yt = Column(Boolean, nullable=False, default=False)
    offline = Column(Boolean, nullable=False, default=True)


class Exam(Base):
    __tablename__ = "exams"

    exam_id = Column(String(32), primary_key=True)
    exam_name = Column(String(128), nullable=False)
    category_id = Column(String(16), ForeignKey("exam_categories.category_id"))
    board_id = Column(String(16), ForeignKey("exam_boards.board_id"), nullable=True)
    exam_year = Column(Integer)
    expiry_date = Column(DateTime)
    pattern_id = Column(String(16), ForeignKey("exam_patterns.pattern_id"))


class ExamQuestionMap(Base):
    __tablename__ = "exam_question_map"

    exam_id = Column(String(32), ForeignKey("exams.exam_id"), primary_key=True)
    qid = Column(String(32), ForeignKey("questions.qid"), primary_key=True)
    section = Column(String(64))
    marks = Column(Float)
    neg_marks = Column(Float)
    q_type_override = Column(String(4), nullable=True)
    scope = Column(String(1))


class ExamCategory(Base):
    __tablename__ = "exam_categories"

    category_id = Column(String(16), primary_key=True)
    category_name = Column(String(64), nullable=False)
    level = Column(Integer)


class ExamBoard(Base):
    __tablename__ = "exam_boards"

    board_id = Column(String(16), primary_key=True)
    board_name = Column(String(64), nullable=False)
    category_id = Column(String(16), ForeignKey("exam_categories.category_id"))


class ExamPattern(Base):
    __tablename__ = "exam_patterns"

    pattern_id = Column(String(16), primary_key=True)
    total_marks = Column(Integer)
    duration_min = Column(Integer)
    sections = Column(JSON)         # JSONB
    neg_mark = Column(Float)


# ─── Tenant Schema ────────────────────────────────────────────────────────────

class Result(Base):
    """
    Every attempt = separate record; never overwritten.
    PK: (uid, qid, attemptNo)
    INSERT ON CONFLICT DO NOTHING — idempotent [!]
    """
    __tablename__ = "results"

    uid = Column(String(16), primary_key=True)       # A-0123-048702
    qid = Column(String(32), primary_key=True)       # MATH-03-02-S-M-C-000123
    attempt_no = Column(Integer, primary_key=True)   # validated server-side in EPS [!]
    bundle_version = Column(Integer)
    exam_or_subject_id = Column(String(32))
    score = Column(Float)
    time_taken = Column(Integer)                     # seconds
    timestamp = Column(BigInteger)                   # UTC epoch


class User(Base):
    __tablename__ = "users"

    uid = Column(String(16), primary_key=True)
    enc_secret = Column(String(64), nullable=False)  # 32-byte hex; never rotated [!]
    settings_update_count = Column(Integer, default=0)
    settings_locked_timestamp = Column(BigInteger, nullable=True)


class UserSettings(Base):
    """
    INSERT ON CONFLICT DO UPDATE if incoming timestamp is newer.
    """
    __tablename__ = "user_settings"

    uid = Column(String(16), primary_key=True)
    timestamp = Column(BigInteger, nullable=False)
    # All settings stored as JSON blob for flexibility
    settings = Column(JSON, nullable=False, default=dict)


class Checkpoint(Base):
    """EPS uses this to track last-processed position per priority folder."""
    __tablename__ = "checkpoints"

    priority_folder = Column(String(32), primary_key=True)
    last_processed_epoch = Column(BigInteger)
    updated_at = Column(BigInteger)


class StudentEnrollment(Base):
    __tablename__ = "student_enrollment"

    uid = Column(String(16), primary_key=True)
    exam_or_subject_id = Column(String(32), primary_key=True)
    bundle_type = Column(String(8))      # "exam" or "subject"
    enrolled_date = Column(DateTime)
    active = Column(Boolean, default=True)


class WeaknessSnapshot(Base):
    """
    Computed by CGS after confirmed tenant PG write [!]
    Never deleted by log clearing [!]
    status: no_data | partial | ready
    """
    __tablename__ = "weakness_snapshot"

    uid = Column(String(16), primary_key=True)
    # JSON: { "MATH": { "03": { "02": 0.72, "03": 0.45 }, ... }, ... }
    accuracy_map = Column(JSON, nullable=False, default=dict)
    status = Column(String(8), nullable=False, default="no_data")  # no_data | partial | ready
    attempt_count = Column(Integer, default=0)
    last_calculated_at = Column(BigInteger)
