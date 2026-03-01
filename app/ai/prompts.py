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

Technical / Engineering formatting:
  - Mathematical expressions use **LaTeX** delimiters (``$...$`` inline,
    ``$$...$$`` block) so the front-end can render them with KaTeX.
  - SI units, standard engineering notation, and proper symbol usage are
    enforced throughout.
"""

# ---------------------------------------------------------------------------
# System prompt — sets the tone and grounding rules (Engineering focus)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert engineering & technical content creator
specialised in producing precise, university-level STEM study material.
Your ONLY job is to produce high-quality, technically rigorous content
**strictly based on the source content provided below**.

CRITICAL RULES:
1. ONLY use facts, definitions, derivations, formulas, and examples that
   appear in the TEACHER-PROVIDED MATERIALS or the LECTURE TRANSCRIPT.
   Do NOT invent or add information from your own knowledge.
2. When the teacher's material contains diagrams, circuit schematics, block
   diagrams, tables, or references, describe them accurately rather than
   guessing their content.
3. If the source material is insufficient to cover a topic, state that
   explicitly — do NOT fill in the gaps with external knowledge.
4. Prioritise teacher-provided materials over raw transcript when they
   overlap — the teacher's curated notes are the authoritative source.
5. Output all responses in valid JSON format as specified in the user prompt.
6. NEVER write in third person about the teacher or lecturer.
   DO NOT write "The teacher explains...", "The lecturer discusses...", etc.
   Write ALL content DIRECTLY as factual, technical statements.
   BAD:  "The teacher explains that Fourier transforms decompose signals."
   GOOD: "The Fourier Transform decomposes a time-domain signal into its
          constituent frequency components."
7. Write as if the notes ARE the authoritative engineering reference — present
   information as direct definitions, theorems, derivations, and proofs.
8. If Wikipedia context is provided, use it to fact-check and supplement
   accuracy but always prioritise the teacher's material.

TECHNICAL FORMATTING RULES:
9.  Write ALL mathematical expressions in **LaTeX** notation:
    - Inline math: wrap in single dollar signs, e.g.  $F = ma$
    - Display / block math: wrap in double dollar signs:
        $$\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)$$
    - Use \\frac{}{}, \\sum, \\int, \\partial, \\nabla, \\vec{}, \\hat{},
      \\mathbf{}, \\text{} etc. as appropriate.
10. Always state SI units using standard abbreviations (m, kg, s, A, V, Hz,
    Pa, N, J, W, etc.) and use proper dimensional notation where helpful.
11. Number every equation that is referenced later: label them as (1), (2),
    etc. inside the text.
12. When presenting derivations, show intermediate algebraic steps clearly —
    do NOT skip steps.  Each step should be on its own display-math line.
13. Use precise engineering terminology: "transfer function" not "formula for
    output", "impulse response" not "reaction to a pulse", etc.
14. For definitions or theorems, use bold labels:
    **Definition:** ... or **Theorem (Name):** ...
15. Use tables (described in JSON) when comparing parameters, specifications,
    or properties of multiple items.
16. Include units in every numerical value: write $v = 3\\,\\text{m/s}$ not
    just $v = 3$."""


# ---------------------------------------------------------------------------
# Notes generation prompt (Engineering / Technical)
# ---------------------------------------------------------------------------
NOTES_PROMPT = """Generate COMPREHENSIVE, technically rigorous lecture notes
for the engineering lecture described below.

Your notes must be **strictly grounded** in the teacher's materials and the
lecture transcript.  Do NOT add information the teacher did not cover.

CRITICAL WRITING STYLE RULES:
- NEVER use third-person references to the teacher, lecturer, or professor.
- Write ALL content as DIRECT technical statements, definitions, theorems,
  derivations, and proofs — as in a professional engineering textbook.
- ALL mathematical expressions MUST use LaTeX notation:
  inline → $expression$   block → $$expression$$
- Include units with every numerical quantity: $v = 5\\,\\text{{m/s}}$.
- Show derivations step-by-step; never skip algebraic steps.
- State theorems and definitions with bold labels.

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
    "summary": "A precise 4-5 sentence technical summary stating the core
                engineering concepts, key equations, and results covered.
                Write as direct factual statements.",
    "overview": "A paragraph explaining the engineering significance of this
                 topic — where it fits in the broader discipline, its practical
                 relevance, and prerequisite knowledge assumed.",
    "sections": [
        {{
            "heading": "Descriptive technical heading (e.g. 'Laplace Transform Properties')",
            "content": "EXTENSIVE content (5-8 paragraphs) presenting definitions,
                        derivations, theorems, and technical explanations in precise
                        engineering prose.  Use LaTeX for ALL math: $V = IR$,
                        $$H(s) = \\\\frac{{Y(s)}}{{X(s)}}$$
                        Show derivation steps line-by-line in display math.",
            "subsections": [
                {{
                    "subheading": "Sub-topic (e.g. 'Linearity Property')",
                    "explanation": "Detailed technical explanation with formulas,
                                     derivation steps, and worked examples."
                }}
            ],
            "formulas": [
                {{
                    "name": "Name or label (e.g. 'Ohm\\'s Law')",
                    "expression": "$V = IR$  or  $$\\\\sum_{{k=0}}^{{N}} a_k z^{{-k}}$$",
                    "description": "Brief explanation of variables, units, and when
                                     this formula applies."
                }}
            ],
            "derivations": [
                {{
                    "title": "Derivation title (e.g. 'Deriving the Transfer Function')",
                    "steps": [
                        "Starting from ... $$equation_1$$",
                        "Applying property X: $$equation_2$$",
                        "Therefore: $$final\\\\_result$$"
                    ],
                    "result": "$$final\\\\_expression$$"
                }}
            ],
            "key_points": [
                "Precise technical point with formula if applicable — e.g. 'The attenuation constant is $\\\\alpha = R/2L$ for a low-loss line.'",
                "Key point 2",
                "Key point 3",
                "Key point 4"
            ],
            "numerical_examples": [
                {{
                    "problem": "Problem statement with given data and units",
                    "solution_steps": [
                        "Step 1: Identify given — ...",
                        "Step 2: Apply formula — $$...$$",
                        "Step 3: Substitute and compute — $$...$$"
                    ],
                    "answer": "Final answer with correct units: $v = 12.5\\\\,\\\\text{{m/s}}$"
                }}
            ],
            "examples": ["Concrete technical example 1", "Example 2"],
            "applications": ["Engineering application 1", "Application 2"]
        }}
    ],
    "key_takeaways": [
        "Core engineering takeaway with formula if relevant",
        "Takeaway 2",
        "Takeaway 3",
        "Takeaway 4"
    ],
    "important_formulas": [
        {{
            "name": "Formula / Theorem name",
            "expression": "$$LaTeX\\\\_expression$$",
            "conditions": "When / where this applies",
            "units": "Units of the result"
        }}
    ],
    "important_concepts": [
        {{
            "concept": "Technical concept name",
            "explanation": "Precise engineering definition with math where needed",
            "related_topics": ["Related concept 1", "Related concept 2"]
        }}
    ],
    "vocabulary": [
        {{"term": "Technical term", "definition": "Precise engineering definition with units / dimensions where applicable"}}
    ],
    "practice_questions": [
        "Conceptual: question 1",
        "Numerical: Compute … given …",
        "Derivation: Derive the expression for …"
    ],
    "further_reading": ["Topic / textbook chapter for further study"],
    "summary_diagram_description": "Description of a block diagram, circuit, flowchart, or conceptual schematic illustrating the key relationships"
}}

REQUIREMENTS:
- Create 5-8 DETAILED sections covering ALL major technical topics from the source material
- Each section must have 5-8 paragraphs of DIRECT, technically precise content
- ALL mathematical expressions must use LaTeX ($...$ or $$...$$)
- Include formulas array in every section that involves equations
- Include derivations array when step-by-step proofs / derivations appear in the material
- Include numerical_examples when the source contains worked problems
- Include 4-6 key points per section, each stated as an engineering fact
- Add a top-level important_formulas array listing the lecture's key equations
- Vocabulary section: 8-15 terms with precise engineering definitions
- Practice questions: mix of conceptual, numerical, and derivation-type
- Only include examples actually present in the source material
- Do NOT add outside facts, theories, or examples not present in the sources
- ZERO sentences should reference "the teacher", "the lecturer", or "the lecture"
"""


# ---------------------------------------------------------------------------
# Assignment generation prompt (Engineering / Technical)
# ---------------------------------------------------------------------------
ASSIGNMENT_PROMPT = """Generate a COMPREHENSIVE, technically rigorous practice
assignment for the engineering lecture described below.

Every question must be **answerable using only the teacher's materials and
the lecture transcript**.  Do NOT create questions about topics not covered.

IMPORTANT: Generate ONLY subjective questions — short answer, long answer,
analytical, numerical/computational, and derivation-type.  Do NOT generate
any multiple-choice (MCQ) or true/false questions.
ALL mathematical expressions MUST use LaTeX notation ($...$ inline, $$...$$ block).

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
    "description": "Description covering technical learning objectives",
    "total_points": 200,
    "instructions": "Answer all questions. Show all derivation steps and
                     include proper units in every numerical answer.",
    "questions": [
        {{
            "type": "short_answer",
            "question": "A concise technical question requiring a 3-5 sentence
                         explanation of a key engineering concept or formula.",
            "expected_answer": "Model answer with precise technical language and
                                formulas in LaTeX (3-5 sentences)",
            "keywords": ["important", "technical", "terms"],
            "hints": ["A helpful engineering hint"],
            "points": 10,
            "difficulty": "easy",
            "topic": "Relevant technical area"
        }},
        {{
            "type": "numerical",
            "question": "Given: [state all data with units].  Find / Compute
                         [quantity] using [method/formula].",
            "given_data": [
                "$R = 10\\\\,\\\\Omega$",
                "$V = 5\\\\,\\\\text{{V}}$"
            ],
            "expected_answer": "Final result with units: $I = 0.5\\\\,\\\\text{{A}}$",
            "solution_steps": [
                "Identify: ... $$formula$$",
                "Substitute: $$...$$",
                "Compute: $$...$$",
                "Result: $answer\\\\,\\\\text{{units}}$"
            ],
            "formula_required": "$$V = IR$$",
            "points": 15,
            "difficulty": "medium",
            "topic": "Relevant technical area"
        }},
        {{
            "type": "derivation",
            "question": "Derive the expression for [quantity] starting from
                         [starting equation / principle].",
            "expected_answer": "Step-by-step derivation ending with $$final\\\\_result$$",
            "solution_steps": [
                "Start from: $$base\\\\_equation$$",
                "Apply [theorem/property]: $$step$$",
                "Simplify: $$step$$",
                "Therefore: $$result$$"
            ],
            "points": 20,
            "difficulty": "medium",
            "topic": "Relevant technical area"
        }},
        {{
            "type": "explain",
            "question": "Explain [concept/mechanism] in detail.  Include the
                         governing equation and its physical significance.",
            "expected_answer": "Detailed technical explanation (5-8 sentences)
                                with formulas and physical interpretation",
            "keywords": ["key", "technical", "concepts"],
            "points": 15,
            "difficulty": "medium",
            "topic": "Relevant technical area"
        }},
        {{
            "type": "analytical",
            "question": "Compare [concept A] and [concept B] in terms of
                         [parameter 1], [parameter 2], and [parameter 3].
                         Support with relevant equations.",
            "expected_answer": "Analytical comparison (6-10 sentences) with
                                mathematical justification where applicable",
            "rubric": "Clear criteria for evaluation",
            "points": 20,
            "difficulty": "medium",
            "topic": "Relevant technical area"
        }},
        {{
            "type": "long_answer",
            "question": "Comprehensive essay-style question requiring synthesis
                         of multiple engineering concepts, derivations, and
                         applications from the lecture.",
            "rubric": "Detailed rubric covering what the answer should include —
                        definitions, derivation, numeric example, applications",
            "expected_answer": "Comprehensive model answer covering all points",
            "points": 30,
            "difficulty": "hard",
            "minimum_words": 300,
            "topic": "Relevant technical area"
        }},
        {{
            "type": "application",
            "question": "Apply [concept/formula] to solve the following
                         engineering scenario: [real-world problem].",
            "expected_answer": "Step-by-step engineering solution",
            "solution_steps": ["Step 1", "Step 2", "Step 3"],
            "points": 25,
            "difficulty": "hard",
            "topic": "Relevant technical area"
        }}
    ],
    "bonus_section": [
        {{
            "type": "critical_thinking",
            "question": "A thought-provoking question that extends the
                         engineering concepts — e.g. design trade-offs,
                         limiting cases, or what-if analysis.",
            "points": 10
        }}
    ]
}}

REQUIREMENTS:
- 4-5 Short answer (easy-medium), 3-4 Numerical (medium), 2-3 Derivation (medium-hard),
  2-3 Explain (medium), 2-3 Analytical (medium-hard), 1-2 Long answer (hard),
  1-2 Application (hard), 1-2 Bonus
- ABSOLUTELY NO MCQs or true/false questions — all questions must be subjective
- ALL mathematical expressions must use LaTeX ($...$ or $$...$$)
- Numerical questions MUST include given_data (with units), formula_required,
  and solution_steps with full computation
- Derivation questions MUST include step-by-step solution_steps
- ALL questions must reference concepts explicitly present in the source material
- Include model expected_answers for every question (teachers use them to evaluate)
- Total: 16-24 questions, 200 points
- Expected answers must be verifiable against the source content"""


# ---------------------------------------------------------------------------
# Flashcard generation prompt (Engineering / Technical)
# ---------------------------------------------------------------------------
FLASHCARDS_PROMPT = """Generate COMPREHENSIVE, technically precise study
flashcards for the engineering lecture described below.

Every card must test a concept, formula, derivation, or technical idea that
appears in the teacher's materials or the lecture transcript.
Do NOT add facts from outside sources.

ALL mathematical expressions MUST use LaTeX notation:
inline → $expression$   block → $$expression$$

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
    "description": "Technical study flashcards for [topic]",
    "total_cards": 30,
    "cards": [
        {{
            "front": "What is [technical term / concept]?",
            "back": "Precise engineering definition (3-5 sentences) with
                     governing equation if applicable: $formula$",
            "difficulty": "easy",
            "category": "Definitions & Fundamentals",
            "formula": "$V = IR$  (if the card involves a key equation — otherwise omit this field)",
            "related_concepts": ["Related concept 1", "Related concept 2"]
        }},
        {{
            "front": "State and express [theorem / law / principle].",
            "back": "**Theorem (Name):** Statement of the theorem.\\n
                     $$mathematical\\\\_expression$$\\n
                     where $var_1$ = …, $var_2$ = … (with units).",
            "difficulty": "medium",
            "category": "Theorems & Laws",
            "formula": "$$key\\\\_equation$$",
            "related_concepts": ["Related topic"]
        }},
        {{
            "front": "Given $data$ with units, compute [quantity].",
            "back": "Apply $formula$:\\n
                     $$substitution$$\\n
                     Result: $answer\\\\,\\\\text{{units}}$",
            "difficulty": "medium",
            "category": "Numerical / Computational",
            "formula": "$$formula\\\\_used$$"
        }},
        {{
            "front": "Derive [expression] starting from [base equation].",
            "back": "Step 1: $$…$$\\n  Step 2: $$…$$\\n  Result: $$final$$",
            "difficulty": "hard",
            "category": "Derivations",
            "formula": "$$derived\\\\_result$$"
        }},
        {{
            "front": "Compare [concept A] vs [concept B].",
            "back": "A: [property 1], [property 2].\\n
                     B: [property 1], [property 2].\\n
                     Key difference: …",
            "difficulty": "hard",
            "category": "Comparisons & Analysis"
        }}
    ]
}}

REQUIREMENTS:
- Generate 25-35 flashcards covering ALL major technical concepts
- Categories should include:
  * Definitions & Fundamentals (8-10 cards) — precise engineering definitions
  * Theorems & Laws (4-6 cards) — statement + formula
  * Formulas & Equations (4-6 cards) — front: name, back: expression + variable definitions + units
  * Numerical / Computational (4-6 cards) — quick-solve problems with worked solutions
  * Derivations (2-4 cards) — outline derivation steps
  * Comparisons & Analysis (3-5 cards) — contrast engineering concepts
- Include a "formula" field on every card that involves a mathematical equation
- ALL math in LaTeX notation ($...$ or $$...$$)
- Every card's back side must reference content from the source material
- Difficulty split: Easy 30-35%, Medium 40-45%, Hard 20-25%
- Include units in every numerical value
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
