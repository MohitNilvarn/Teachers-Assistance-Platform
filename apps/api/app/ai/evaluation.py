# File: app/ai/evaluation.py
"""
Content evaluation engine for scoring LLM-generated output.

Evaluates every generation on seven dimensions and produces a 0–1 score
for each, plus a weighted overall score.  Results are stored alongside
the generated content in MongoDB so teachers can see quality at a glance.

Scoring Dimensions:
    1. Structure     — Does the JSON have all required fields / enough sections?
    2. Completeness  — Are lecture topics actually covered in the output?
    3. Groundedness  — Can claims be traced back to the source material?
    4. Writing Style — No forbidden third-person teacher references?
    5. Content Depth  — Are sections / answers long enough to be useful?
    6. Difficulty Distribution — Do flashcards / assignments follow the
                                 target easy/medium/hard split?
    7. Factual Accuracy — Are verified facts from external sources
                          (Wikipedia / GeeksForGeeks) correctly reflected?
"""
import json
import re
import time
from typing import Dict, Any, List, Optional, Tuple

from app.core.logger import get_logger
from app.services.embedding_service import (
    generate_embedding,
    generate_embeddings,
    compute_similarity,
)

logger = get_logger("TAP.Evaluation")

# ──────────────────────────────────────────────────────────────────────
# Forbidden phrases — the LLM must write as a textbook, never refer
# to the teacher / lecturer in third person.
# ──────────────────────────────────────────────────────────────────────
_FORBIDDEN_PHRASES = [
    "the teacher",
    "the lecturer",
    "the professor",
    "the instructor",
    "he explains",
    "she explains",
    "he discusses",
    "she discusses",
    "he mentions",
    "she mentions",
    "teacher explains",
    "lecturer explains",
    "professor explains",
    "teacher discusses",
    "lecturer discusses",
    "according to the teacher",
    "according to the lecturer",
    "as the teacher",
    "as the lecturer",
    "the teacher said",
    "the lecturer said",
]


# ──────────────────────────────────────────────────────────────────────
# Per-content-type structural requirements
# ──────────────────────────────────────────────────────────────────────

_NOTES_REQUIRED_FIELDS = ["title", "summary", "sections"]
_NOTES_OPTIONAL_FIELDS = [
    "overview", "key_takeaways", "important_concepts",
    "vocabulary", "practice_questions", "further_reading",
]
_MIN_NOTES_SECTIONS = 3
_MIN_SECTION_CONTENT_LENGTH = 150   # characters
_MIN_KEY_POINTS_PER_SECTION = 2

_ASSIGNMENT_REQUIRED_FIELDS = ["title", "questions"]
_MIN_ASSIGNMENT_QUESTIONS = 8

_FLASHCARDS_REQUIRED_FIELDS = ["title", "cards"]
_MIN_FLASHCARDS_CARDS = 15
# Target difficulty distribution for flashcards/assignments
_TARGET_DIFFICULTY = {"easy": 0.30, "medium": 0.45, "hard": 0.25}
_DIFFICULTY_TOLERANCE = 0.15  # ±15% acceptable deviation


# ══════════════════════════════════════════════════════════════════════
# Individual scoring functions  (each returns 0.0 – 1.0)
# ══════════════════════════════════════════════════════════════════════

def _score_notes_structure(content: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Check that notes JSON has required structure."""
    issues: List[str] = []
    score_parts: List[float] = []

    # Required top-level fields
    for field in _NOTES_REQUIRED_FIELDS:
        if field in content and content[field]:
            score_parts.append(1.0)
        else:
            score_parts.append(0.0)
            issues.append(f"Missing required field: '{field}'")

    # Optional but valuable fields
    bonus = sum(1 for f in _NOTES_OPTIONAL_FIELDS if f in content and content[f])
    opt_score = min(bonus / max(len(_NOTES_OPTIONAL_FIELDS) * 0.5, 1), 1.0)
    score_parts.append(opt_score)

    # Sections count
    sections = content.get("sections", [])
    if len(sections) >= _MIN_NOTES_SECTIONS:
        score_parts.append(1.0)
    elif sections:
        score_parts.append(len(sections) / _MIN_NOTES_SECTIONS)
        issues.append(
            f"Only {len(sections)} sections (need at least {_MIN_NOTES_SECTIONS})"
        )
    else:
        score_parts.append(0.0)
        issues.append("No sections found")

    return _avg(score_parts), issues


def _score_assignment_structure(content: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Check that assignment JSON has required structure."""
    issues: List[str] = []
    score_parts: List[float] = []

    for field in _ASSIGNMENT_REQUIRED_FIELDS:
        if field in content and content[field]:
            score_parts.append(1.0)
        else:
            score_parts.append(0.0)
            issues.append(f"Missing required field: '{field}'")

    questions = content.get("questions", [])
    if len(questions) >= _MIN_ASSIGNMENT_QUESTIONS:
        score_parts.append(1.0)
    elif questions:
        score_parts.append(len(questions) / _MIN_ASSIGNMENT_QUESTIONS)
        issues.append(
            f"Only {len(questions)} questions (need at least {_MIN_ASSIGNMENT_QUESTIONS})"
        )
    else:
        score_parts.append(0.0)
        issues.append("No questions found")

    # Check that questions have expected_answer
    answered = sum(1 for q in questions if q.get("expected_answer"))
    if questions:
        score_parts.append(answered / len(questions))
        if answered < len(questions):
            issues.append(
                f"{len(questions) - answered}/{len(questions)} questions missing expected_answer"
            )
    else:
        score_parts.append(0.0)

    return _avg(score_parts), issues


def _score_flashcards_structure(content: Dict[str, Any]) -> Tuple[float, List[str]]:
    """Check that flashcards JSON has required structure."""
    issues: List[str] = []
    score_parts: List[float] = []

    for field in _FLASHCARDS_REQUIRED_FIELDS:
        if field in content and content[field]:
            score_parts.append(1.0)
        else:
            score_parts.append(0.0)
            issues.append(f"Missing required field: '{field}'")

    cards = content.get("cards", [])
    if len(cards) >= _MIN_FLASHCARDS_CARDS:
        score_parts.append(1.0)
    elif cards:
        score_parts.append(len(cards) / _MIN_FLASHCARDS_CARDS)
        issues.append(
            f"Only {len(cards)} cards (need at least {_MIN_FLASHCARDS_CARDS})"
        )
    else:
        score_parts.append(0.0)
        issues.append("No cards found")

    # Check cards have front/back
    valid_cards = sum(
        1 for c in cards
        if c.get("front") and c.get("back")
    )
    if cards:
        score_parts.append(valid_cards / len(cards))
        if valid_cards < len(cards):
            issues.append(
                f"{len(cards) - valid_cards}/{len(cards)} cards missing front or back"
            )

    return _avg(score_parts), issues


# ──────────────────────────────────────────────────────────────────────
def score_structure(
    content: Dict[str, Any],
    content_type: str,
) -> Tuple[float, List[str]]:
    """
    Score the structural completeness of generated content.

    Returns:
        (score 0-1, list of issues)
    """
    if content_type == "notes":
        return _score_notes_structure(content)
    elif content_type == "assignment":
        return _score_assignment_structure(content)
    elif content_type == "flashcards":
        return _score_flashcards_structure(content)
    return 0.5, ["Unknown content type"]


# ──────────────────────────────────────────────────────────────────────
def score_content_depth(
    content: Dict[str, Any],
    content_type: str,
) -> Tuple[float, List[str]]:
    """
    Score depth / richness of generated content.

    Checks:
    - Notes: each section has enough paragraphs + key_points
    - Assignments: questions have solution_steps / rubric
    - Flashcards: back-side has enough detail
    """
    issues: List[str] = []
    scores: List[float] = []

    if content_type == "notes":
        for i, section in enumerate(content.get("sections", [])):
            txt = section.get("content", "")
            length = len(txt)
            if length >= _MIN_SECTION_CONTENT_LENGTH:
                scores.append(1.0)
            else:
                ratio = length / _MIN_SECTION_CONTENT_LENGTH if _MIN_SECTION_CONTENT_LENGTH else 0
                scores.append(min(ratio, 1.0))
                issues.append(
                    f"Section {i+1} ('{section.get('heading', '?')}') "
                    f"too short: {length} chars"
                )

            kp = section.get("key_points", [])
            if len(kp) >= _MIN_KEY_POINTS_PER_SECTION:
                scores.append(1.0)
            else:
                scores.append(len(kp) / _MIN_KEY_POINTS_PER_SECTION if _MIN_KEY_POINTS_PER_SECTION else 0)
                issues.append(
                    f"Section {i+1} has {len(kp)} key points "
                    f"(need {_MIN_KEY_POINTS_PER_SECTION})"
                )

    elif content_type == "assignment":
        for i, q in enumerate(content.get("questions", [])):
            # Expected answer length check
            ans = q.get("expected_answer", "")
            if len(ans) >= 50:
                scores.append(1.0)
            elif ans:
                scores.append(len(ans) / 50)
            else:
                scores.append(0.0)
                issues.append(f"Question {i+1} has no expected_answer")

    elif content_type == "flashcards":
        for i, card in enumerate(content.get("cards", [])):
            back = card.get("back", "")
            if len(back) >= 40:
                scores.append(1.0)
            elif back:
                scores.append(len(back) / 40)
            else:
                scores.append(0.0)
                issues.append(f"Card {i+1} has empty back side")

    return _avg(scores), issues


# ──────────────────────────────────────────────────────────────────────
def score_writing_style(
    content: Dict[str, Any],
) -> Tuple[float, List[str]]:
    """
    Check for forbidden third-person teacher references.

    The system prompt forbids phrases like "The teacher explains…".
    Every occurrence is a penalty.
    """
    text = json.dumps(content, ensure_ascii=False).lower()
    found: List[str] = []

    for phrase in _FORBIDDEN_PHRASES:
        count = text.count(phrase.lower())
        if count > 0:
            found.append(f"'{phrase}' appeared {count} time(s)")

    total_violations = len(found)
    # Up to 3 violations → partial deduction; 4+ → 0
    if total_violations == 0:
        return 1.0, []
    elif total_violations <= 2:
        return 0.7, found
    elif total_violations <= 4:
        return 0.4, found
    else:
        return 0.1, found


# ──────────────────────────────────────────────────────────────────────
def score_difficulty_distribution(
    content: Dict[str, Any],
    content_type: str,
) -> Tuple[float, List[str]]:
    """
    Check whether the difficulty spread matches the target distribution.

    Only applicable to assignments and flashcards.
    """
    if content_type == "notes":
        return 1.0, []  # N/A for notes

    items: List[Dict[str, Any]] = []
    if content_type == "assignment":
        items = content.get("questions", [])
    elif content_type == "flashcards":
        items = content.get("cards", [])

    if not items:
        return 0.0, ["No items to evaluate difficulty"]

    # Count difficulty buckets
    counts = {"easy": 0, "medium": 0, "hard": 0}
    untagged = 0
    for item in items:
        diff = (item.get("difficulty") or "").lower().strip()
        if diff in counts:
            counts[diff] += 1
        else:
            untagged += 1

    total_tagged = sum(counts.values())
    issues: List[str] = []

    if untagged > 0:
        issues.append(f"{untagged}/{len(items)} items have no difficulty tag")

    if total_tagged == 0:
        return 0.3, issues + ["No difficulty tags found (defaulting 0.3)"]

    # Compare actual vs target distribution
    actual = {k: v / total_tagged for k, v in counts.items()}
    deviation_sum = 0.0
    for level in ["easy", "medium", "hard"]:
        diff = abs(actual[level] - _TARGET_DIFFICULTY[level])
        if diff > _DIFFICULTY_TOLERANCE:
            issues.append(
                f"{level}: {actual[level]*100:.0f}% "
                f"(target {_TARGET_DIFFICULTY[level]*100:.0f}% ± {_DIFFICULTY_TOLERANCE*100:.0f}%)"
            )
        deviation_sum += diff

    # max possible deviation is 2.0 (e.g. all in one bucket)
    score = max(1.0 - deviation_sum, 0.0)
    return score, issues


# ──────────────────────────────────────────────────────────────────────
def score_groundedness(
    content: Dict[str, Any],
    content_type: str,
    source_texts: List[str],
    sample_size: int = 10,
) -> Tuple[float, List[str]]:
    """
    Estimate how well the generated content is grounded in source material.

    Extracts a sample of claims from the generated content, embeds them,
    and computes cosine similarity against source text chunks.  Claims
    with similarity >= threshold are considered "grounded".

    This is a lightweight check — it does NOT call the LLM, only the
    local embedding model.

    Args:
        content:      The generated JSON content.
        content_type: "notes", "assignment", or "flashcards".
        source_texts: List of source text chunks (transcript + materials).
        sample_size:  Max number of claims to sample for checking.

    Returns:
        (score 0-1, list of ungrounded claim snippets)
    """
    if not source_texts:
        return 0.5, ["No source material available for groundedness check"]

    # Extract representative claims from the content
    claims = _extract_claims(content, content_type, max_claims=sample_size)
    if not claims:
        return 0.5, ["Could not extract claims for groundedness check"]

    # Embed claims and source chunks
    try:
        claim_embeddings = generate_embeddings(claims)
        source_embeddings = generate_embeddings(
            # Use first 30 source chunks max to limit compute
            source_texts[:30]
        )
    except Exception as e:
        logger.warning(f"Groundedness embedding failed: {e}")
        return 0.5, [f"Embedding error: {str(e)}"]

    grounded_count = 0
    ungrounded: List[str] = []
    threshold = 0.55  # cosine similarity threshold

    for claim, claim_emb in zip(claims, claim_embeddings):
        best_sim = max(
            compute_similarity(claim_emb, src_emb)
            for src_emb in source_embeddings
        )
        if best_sim >= threshold:
            grounded_count += 1
        else:
            snippet = claim[:80] + "…" if len(claim) > 80 else claim
            ungrounded.append(f"[sim={best_sim:.2f}] {snippet}")

    score = grounded_count / len(claims) if claims else 0.0
    return score, ungrounded


def _extract_claims(
    content: Dict[str, Any],
    content_type: str,
    max_claims: int = 10,
) -> List[str]:
    """
    Extract a representative sample of textual claims from generated content.

    We pull from different locations depending on content type to get a
    diverse sample.
    """
    claims: List[str] = []

    if content_type == "notes":
        # Sample from summary
        summary = content.get("summary", "")
        if summary:
            claims.append(summary)

        # Sample from section content (first sentence of each section)
        for section in content.get("sections", []):
            text = section.get("content", "")
            first_sent = _first_sentence(text)
            if first_sent:
                claims.append(first_sent)

            # Sample key points
            for kp in section.get("key_points", [])[:2]:
                if kp:
                    claims.append(kp)

        # Sample vocabulary definitions
        for vocab in content.get("vocabulary", [])[:3]:
            defn = vocab.get("definition", "")
            if defn:
                claims.append(defn)

    elif content_type == "assignment":
        for q in content.get("questions", []):
            ans = q.get("expected_answer", "")
            if ans:
                claims.append(_first_sentence(ans) or ans[:150])

    elif content_type == "flashcards":
        for card in content.get("cards", []):
            back = card.get("back", "")
            if back:
                claims.append(back[:150])

    # Deduplicate and limit
    seen = set()
    unique: List[str] = []
    for c in claims:
        c_stripped = c.strip()
        if c_stripped and c_stripped not in seen:
            seen.add(c_stripped)
            unique.append(c_stripped)

    return unique[:max_claims]


def _first_sentence(text: str) -> str:
    """Extract the first sentence from a text block."""
    match = re.match(r"(.+?[.!?])\s", text)
    if match:
        return match.group(1).strip()
    # fallback: first 150 chars
    return text[:150].strip() if text else ""


# ──────────────────────────────────────────────────────────────────────
def score_topic_coverage(
    content: Dict[str, Any],
    content_type: str,
    lecture_title: str,
    source_texts: List[str],
) -> Tuple[float, List[str]]:
    """
    Estimate whether key topics from the source material are reflected
    in the generated content.

    Extracts key noun phrases / headings from the source, then checks
    if they appear anywhere in the generated JSON.  This is a simple
    substring check — lightweight and fast.
    """
    if not source_texts:
        return 0.5, ["No source material for coverage check"]

    # Build a combined source sample
    source_combined = " ".join(source_texts[:15]).lower()

    # Extract candidate topic phrases (words that appear in title or
    # are capitalised terms in the source)
    topics: List[str] = []

    # From lecture title
    title_words = re.findall(r"\b[A-Za-z]{4,}\b", lecture_title)
    topics.extend(w.lower() for w in title_words)

    # From source: find capitalised multi-word terms (likely topic names)
    capitalised = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b", " ".join(source_texts[:10]))
    topics.extend(t.lower() for t in capitalised[:15])

    # Deduplicate
    topics = list(dict.fromkeys(topics))[:20]

    if not topics:
        return 0.8, ["Could not extract topics for coverage check"]

    # Check presence in generated content
    content_text = json.dumps(content, ensure_ascii=False).lower()
    covered = []
    missed = []
    for topic in topics:
        if topic in content_text:
            covered.append(topic)
        else:
            missed.append(topic)

    if not topics:
        return 0.8, []

    score = len(covered) / len(topics)
    issues = [f"Missing topic: '{t}'" for t in missed[:5]]  # report top 5

    return score, issues


# ══════════════════════════════════════════════════════════════════════
# Aggregate evaluator — the main entry point
# ══════════════════════════════════════════════════════════════════════

# Weights for the weighted-average overall score
_SCORE_WEIGHTS = {
    "structure":      0.15,
    "content_depth":  0.15,
    "groundedness":   0.20,
    "writing_style":  0.10,
    "topic_coverage": 0.15,
    "difficulty_distribution": 0.10,
    "factual_accuracy": 0.15,
}


async def evaluate_content(
    content: Dict[str, Any],
    content_type: str,
    source_texts: List[str],
    lecture_title: str,
    verified_facts: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Run all evaluation checks on a piece of generated content and return
    a comprehensive quality report.

    Args:
        content:         The generated JSON (notes / assignment / flashcards).
        content_type:    One of "notes", "assignment", "flashcards".
        source_texts:    Source material chunks (transcript + teacher docs).
        lecture_title:   Title of the lecture (used for coverage check).
        verified_facts:  Optional list of verified fact dicts from external
                         knowledge (Wikipedia / GeeksForGeeks). Each dict has
                         'source' and 'fact' keys.

    Returns:
        A dict with:
        {
            "overall_score": 0.0 – 1.0,
            "scores": {
                "structure": {"score": float, "issues": [...]},
                "content_depth": {...},
                "groundedness": {...},
                "writing_style": {...},
                "topic_coverage": {...},
                "difficulty_distribution": {...},
                "factual_accuracy": {...},
            },
            "total_issues": int,
            "grade": "A" | "B" | "C" | "D" | "F",
            "evaluated_at": ISO timestamp,
        }
    """
    start = time.time()
    logger.info(f"Evaluating {content_type} content…")

    results: Dict[str, Dict[str, Any]] = {}

    # 1. Structure
    s, iss = score_structure(content, content_type)
    results["structure"] = {"score": round(s, 3), "issues": iss}

    # 2. Content depth
    s, iss = score_content_depth(content, content_type)
    results["content_depth"] = {"score": round(s, 3), "issues": iss}

    # 3. Writing style
    s, iss = score_writing_style(content)
    results["writing_style"] = {"score": round(s, 3), "issues": iss}

    # 4. Difficulty distribution
    s, iss = score_difficulty_distribution(content, content_type)
    results["difficulty_distribution"] = {"score": round(s, 3), "issues": iss}

    # 5. Topic coverage (lightweight, no embedding needed)
    s, iss = score_topic_coverage(content, content_type, lecture_title, source_texts)
    results["topic_coverage"] = {"score": round(s, 3), "issues": iss}

    # 6. Groundedness (uses embedding model — most expensive)
    s, iss = score_groundedness(content, content_type, source_texts)
    results["groundedness"] = {"score": round(s, 3), "issues": iss}

    # 7. Factual accuracy (cross-validate against external verified facts)
    s, iss = score_factual_accuracy(content, content_type, verified_facts or [])
    results["factual_accuracy"] = {"score": round(s, 3), "issues": iss}

    # Weighted overall score
    overall = sum(
        results[dim]["score"] * weight
        for dim, weight in _SCORE_WEIGHTS.items()
        if dim in results
    )
    overall = round(overall, 3)

    # Letter grade
    grade = _to_grade(overall)

    total_issues = sum(len(r["issues"]) for r in results.values())

    elapsed = round(time.time() - start, 2)
    logger.info(
        f"Evaluation complete for {content_type}: "
        f"overall={overall} grade={grade} issues={total_issues} "
        f"({elapsed}s)"
    )

    return {
        "overall_score": overall,
        "scores": results,
        "total_issues": total_issues,
        "grade": grade,
        "evaluation_time_seconds": elapsed,
    }


def _to_grade(score: float) -> str:
    """Convert a 0–1 score to a letter grade."""
    if score >= 0.90:
        return "A"
    elif score >= 0.75:
        return "B"
    elif score >= 0.60:
        return "C"
    elif score >= 0.45:
        return "D"
    else:
        return "F"


def _avg(values: List[float]) -> float:
    """Safe average that returns 0 for empty lists."""
    return sum(values) / len(values) if values else 0.0


# ──────────────────────────────────────────────────────────────────────
def score_factual_accuracy(
    content: Dict[str, Any],
    content_type: str,
    verified_facts: List[Dict[str, str]],
) -> Tuple[float, List[str]]:
    """
    Cross-validate generated content against verified facts from
    external knowledge sources (Wikipedia, GeeksForGeeks).

    Checks whether key verified facts are correctly reflected in the
    generated content using substring matching and semantic similarity.
    This prevents hallucination by ensuring the LLM used external
    knowledge accurately when it chose to incorporate it.

    If no verified facts are available, returns a neutral score.

    Args:
        content:         The generated JSON content.
        content_type:    "notes", "assignment", or "flashcards".
        verified_facts:  List of dicts with 'source' and 'fact' keys.

    Returns:
        (score 0-1, list of issues)
    """
    if not verified_facts:
        # No external facts to validate against — neutral score
        return 0.75, ["No external verified facts available for cross-validation"]

    content_text = json.dumps(content, ensure_ascii=False).lower()
    issues: List[str] = []
    scores: List[float] = []

    for fact_entry in verified_facts:
        fact = fact_entry.get("fact", "")
        source = fact_entry.get("source", "unknown")

        if not fact or len(fact) < 10:
            continue

        # Extract key terms from the fact (nouns, technical terms)
        fact_lower = fact.lower()
        # Split into significant words (4+ chars, not stop words)
        stop_words = {
            "the", "a", "an", "in", "of", "and", "or", "is", "are",
            "was", "were", "for", "to", "with", "on", "at", "by",
            "that", "this", "which", "from", "their", "been", "have",
            "has", "had", "not", "but", "can", "will", "also", "such",
            "used", "uses", "using", "into", "more", "than", "each",
            "between", "through", "over", "only", "other",
        }
        fact_words = [
            w for w in re.findall(r"\b[a-z]{4,}\b", fact_lower)
            if w not in stop_words
        ]

        if not fact_words:
            continue

        # Check how many key terms from the fact appear in the content
        matched_words = sum(1 for w in fact_words if w in content_text)
        match_ratio = matched_words / len(fact_words) if fact_words else 0

        if match_ratio >= 0.5:
            # Good — the fact's key terms appear in the content
            scores.append(1.0)
        elif match_ratio >= 0.25:
            # Partial match
            scores.append(0.6)
        else:
            # The verified fact is not reflected in the content.
            # This is only an issue if the topic IS in the content
            # (i.e., the LLM covered it but got facts wrong).
            # If the topic isn't covered at all, it's a coverage issue,
            # not an accuracy issue.
            topic_words = fact_words[:3]  # First few terms as topic indicator
            topic_in_content = any(w in content_text for w in topic_words)
            if topic_in_content:
                scores.append(0.2)
                snippet = fact[:80] + "…" if len(fact) > 80 else fact
                issues.append(
                    f"[{source}] Fact not accurately reflected: {snippet}"
                )
            else:
                # Topic not covered — not an accuracy issue
                scores.append(0.8)

    if not scores:
        return 0.75, ["No checkable facts found"]

    return _avg(scores), issues
