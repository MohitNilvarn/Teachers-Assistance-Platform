# File: app/ai/prompts.py
"""
Prompt templates for content generation.

All prompts enforce **strict grounding**: the LLM must only use information
that comes from (a) the teacher-provided materials for the lecture and
(b) the lecture transcript.  This prevents hallucinated or off-topic content.

The ``{context}`` placeholder is populated by the AI graph with two clearly
labelled sections:
  - "=== TEACHER-PROVIDED MATERIALS ===" — PDFs/docs the teacher uploaded
  - "=== LECTURE TRANSCRIPT EXCERPTS ===" — relevant transcript chunks
"""

# ---------------------------------------------------------------------------
# System prompt — sets the tone and grounding rules
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert educational content creator working as a professor's assistant.
Your ONLY job is to produce high-quality study material **strictly based on the source content provided below**.

CRITICAL RULES:
1. ONLY use facts, definitions, concepts, and examples that appear in the
   TEACHER-PROVIDED MATERIALS or the LECTURE TRANSCRIPT.  Do NOT invent or
   add information from your own knowledge.
2. When the teacher's material contains diagrams, tables, or references,
   describe them accurately rather than guessing their content.
3. If the source material is insufficient to cover a topic, state that
   explicitly — do NOT fill in the gaps with external knowledge.
4. Prioritise teacher-provided materials over raw transcript when they
   overlap — the teacher's curated notes are the authoritative source.
5. Output all responses in valid JSON format as specified in the user prompt.
6. Use academic but accessible language suitable for university students."""


# ---------------------------------------------------------------------------
# Notes generation prompt
# ---------------------------------------------------------------------------
NOTES_PROMPT = """Generate COMPREHENSIVE lecture notes for the lecture described below.

Your notes must be **strictly grounded** in the teacher's materials and the
lecture transcript.  Do NOT add information the teacher did not cover.

─────────────────────────────────
LECTURE TITLE: {lecture_title}
─────────────────────────────────

TEACHER-PROVIDED MATERIALS & LECTURE TRANSCRIPT:
{context}

FULL LECTURE TRANSCRIPT (for completeness):
{transcript}

─────────────────────────────────

Generate structured notes in the following JSON format:
{{
    "title": "Lecture Notes: [Topic]",
    "summary": "A detailed 4-5 sentence summary covering the main themes discussed in the lecture",
    "overview": "A paragraph explaining the importance and context of this topic as presented by the teacher",
    "sections": [
        {{
            "heading": "Section heading (derived from teacher material or transcript structure)",
            "content": "EXTENSIVE detailed content (5-8 paragraphs) drawn directly from the teacher's material and transcript, with real-world examples the teacher mentioned",
            "subsections": [
                {{
                    "subheading": "Sub-topic detail",
                    "explanation": "Detailed explanation using the teacher's own examples and context"
                }}
            ],
            "key_points": ["Key point from teacher material 1", "Key point 2", "Key point 3", "Key point 4"],
            "examples": ["Example the teacher used 1", "Example the teacher used 2"],
            "applications": ["Application mentioned by teacher 1", "Application 2"]
        }}
    ],
    "key_takeaways": ["Takeaway 1 from the lecture", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
    "important_concepts": [
        {{
            "concept": "Central concept from the lecture",
            "explanation": "Explanation as given in teacher material / transcript",
            "related_topics": ["Related concept mentioned 1", "Related concept 2"]
        }}
    ],
    "vocabulary": [
        {{"term": "Technical term from lecture", "definition": "Definition as provided by teacher"}}
    ],
    "practice_questions": ["Question based on lecture content 1", "Question 2", "Question 3"],
    "further_reading": ["Topic mentioned by the teacher for further study"],
    "summary_diagram_description": "Description of a conceptual diagram based on the teacher's material"
}}

REQUIREMENTS:
- Create 5-8 DETAILED sections covering ALL major topics from the teacher's material and transcript
- Each section must have 5-8 paragraphs drawn DIRECTLY from the source content
- Include 4-6 key points per section — each must trace back to the material or transcript
- Only include examples the teacher actually used or mentioned
- Add 5-8 key takeaways that reflect the teacher's emphasis
- Vocabulary section: 8-15 terms with definitions as the teacher stated them
- Practice questions must be answerable solely from the lecture content
- Do NOT add outside facts, theories, or examples not present in the sources"""


# ---------------------------------------------------------------------------
# Assignment generation prompt
# ---------------------------------------------------------------------------
ASSIGNMENT_PROMPT = """Generate a COMPREHENSIVE practice assignment for the lecture described below.

Every question must be **answerable using only the teacher's materials and
the lecture transcript**.  Do NOT create questions about topics the teacher
did not cover.

─────────────────────────────────
LECTURE TITLE: {lecture_title}
─────────────────────────────────

TEACHER-PROVIDED MATERIALS & LECTURE TRANSCRIPT:
{context}

FULL LECTURE TRANSCRIPT (for completeness):
{transcript}

─────────────────────────────────

Generate an assignment in the following JSON format:
{{
    "title": "Practice Assignment: [Topic]",
    "description": "Description covering learning objectives as taught by the teacher",
    "total_points": 200,
    "instructions": "Clear instructions for students",
    "questions": [
        {{
            "type": "mcq",
            "question": "MCQ text — must reference content from the lecture",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct_answer": "A",
            "explanation": "Explanation referencing the teacher's material",
            "points": 5,
            "difficulty": "easy",
            "topic": "Topic covered in lecture"
        }},
        {{
            "type": "short_answer",
            "question": "Short answer question on a concept the teacher explained",
            "expected_answer": "Answer drawn from teacher material (3-5 sentences)",
            "keywords": ["key", "words", "from", "lecture"],
            "hints": ["Hint referencing what teacher said"],
            "points": 15,
            "difficulty": "medium"
        }},
        {{
            "type": "long_answer",
            "question": "Essay question requiring synthesis of teacher material",
            "rubric": "Rubric based on concepts the teacher covered",
            "points": 30,
            "difficulty": "hard",
            "minimum_words": 400
        }},
        {{
            "type": "problem_solving",
            "question": "Problem based on examples from the teacher's material",
            "solution_steps": ["Step 1 from lecture", "Step 2 from lecture"],
            "points": 20,
            "difficulty": "hard"
        }}
    ],
    "bonus_section": [
        {{
            "type": "research_based",
            "question": "Extension question tied to a topic the teacher raised",
            "points": 10
        }}
    ]
}}

REQUIREMENTS:
- 6-8 MCQ, 4-6 Short answer, 2-3 Long answer, 1-2 Problem-solving, 1-2 Bonus
- ALL questions must reference concepts explicitly present in the teacher's material or transcript
- Include detailed explanations referencing the source material
- Progress from easier to harder difficulty
- Total: 14-20 questions, 200 points
- Correct answers and explanations must be verifiable against the teacher's content"""


# ---------------------------------------------------------------------------
# Flashcard generation prompt
# ---------------------------------------------------------------------------
FLASHCARDS_PROMPT = """Generate COMPREHENSIVE study flashcards for the lecture described below.

Every card must test a concept, term, or idea that appears in the teacher's
materials or the lecture transcript.  Do NOT add facts from outside sources.

─────────────────────────────────
LECTURE TITLE: {lecture_title}
─────────────────────────────────

TEACHER-PROVIDED MATERIALS & LECTURE TRANSCRIPT:
{context}

FULL LECTURE TRANSCRIPT (for completeness):
{transcript}

─────────────────────────────────

Generate flashcards in the following JSON format:
{{
    "title": "Flashcards: [Topic]",
    "description": "Study flashcards based on teacher material for [topic]",
    "total_cards": 30,
    "cards": [
        {{
            "front": "Key question or term from the lecture",
            "back": "Answer drawn directly from teacher material (3-5 sentences)",
            "difficulty": "easy",
            "category": "Category from lecture structure",
            "mnemonics": "Memory aid if present in teacher material",
            "related_concepts": ["Related concept 1", "Related concept 2"]
        }},
        {{
            "front": "What is [concept] and why is it important?",
            "back": "Definition and importance as stated by the teacher (4-6 sentences)",
            "difficulty": "medium",
            "category": "Core concepts",
            "examples": ["Example used by teacher 1", "Example 2"],
            "visual_description": "Diagram description if teacher provided one"
        }},
        {{
            "front": "How does [concept A] relate to [concept B]?",
            "back": "Relationship as explained in the lecture (4-5 sentences)",
            "difficulty": "hard",
            "category": "Advanced concepts"
        }}
    ]
}}

REQUIREMENTS:
- Generate 25-35 flashcards covering ALL major concepts from the teacher's material
- Categories:
  * Definitions and Basic Concepts (8-10 cards)
  * Key Principles and Theories as taught (6-8 cards)
  * Applications and Examples from class (6-8 cards)
  * Relationships and Comparisons the teacher drew (4-6 cards)
  * Advanced/Synthesis concepts from lecture (3-5 cards)
- Every card's back side must reference content from the source material
- Difficulty split: Easy 35-40%, Medium 40-45%, Hard 15-20%
- Include examples and applications only if the teacher mentioned them
- Do NOT add supplementary information not found in the provided context"""


# ---------------------------------------------------------------------------
# Prompt formatters
# ---------------------------------------------------------------------------

def get_notes_prompt(transcript: str, context: str, lecture_title: str) -> str:
    """Format the notes generation prompt."""
    return NOTES_PROMPT.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )


def get_assignment_prompt(transcript: str, context: str, lecture_title: str) -> str:
    """Format the assignment generation prompt."""
    return ASSIGNMENT_PROMPT.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )


def get_flashcards_prompt(transcript: str, context: str, lecture_title: str) -> str:
    """Format the flashcards generation prompt."""
    return FLASHCARDS_PROMPT.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )
