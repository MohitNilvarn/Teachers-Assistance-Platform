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

Subject-nature-aware formatting:
  - For MATHEMATICAL subjects: LaTeX math, derivations, numerical examples.
  - For THEORETICAL subjects: clear prose, definitions, comparisons, diagrams.
  The subject_nature is auto-detected from the transcript content.
"""
import re
from app.core.logger import get_logger

_prompt_logger = get_logger("TAP.Prompts")

# ---------------------------------------------------------------------------
# Subject nature detection
# ---------------------------------------------------------------------------

# Keywords that indicate mathematical / formula-heavy content
_MATH_KEYWORDS = re.compile(
    r"\b("
    r"equation|formula|deriv(e|ation|ative)|integral|differentiat"
    r"|matrix|matrices|eigenvalue|eigenvector|determinant"
    r"|theorem|lemma|proof|corollary"
    r"|sin\b|cos\b|tan\b|logarithm|exponential"
    r"|laplace|fourier|z-transform|transfer\s*function"
    r"|impedance|resistance|capacitance|inductance|ohm"
    r"|voltage|current(?!\s+trends)|circuit|amplifier|transistor|diode"
    r"|frequency|bandwidth|wavelength|attenuation"
    r"|newton|force|torque|momentum|acceleration|velocity"
    r"|thermodynamic|entropy|enthalpy|heat\s*transfer"
    r"|stress|strain|modulus|elasticity|bending\s*moment"
    r"|signal\s*processing|filter\s*design|convolution|correlation|spectrum"
    r"|probability\s*distribution|variance|standard\s*deviation"
    r"|numerical\s*method|interpolation|regression"
    r"|PDE|ODE|boundary\s*value|initial\s*value"
    r")\b",
    re.IGNORECASE,
)

# Keywords that indicate theoretical / conceptual content
_THEORY_KEYWORDS = re.compile(
    r"\b("
    r"cloud\s*computing|deployment\s*model|service\s*model"
    r"|IaaS|PaaS|SaaS|virtualization|virtual\s*machine|hypervisor|container"
    r"|VMware|VirtualBox|Hyper-V|KVM|Xen|snapshot|migration|provisioning"
    r"|software\s*engineering|SDLC|agile|scrum|waterfall|devops"
    r"|database|normalization|SQL|NoSQL|relational|schema"
    r"|operating\s*system|process\s*management|thread|scheduling|deadlock|paging"
    r"|computer\s*network|TCP|UDP|IP\s*address|OSI\s*model|protocol|routing"
    r"|web\s*technology|HTML|CSS|REST\s*API|HTTP|microservice"
    r"|artificial\s*intelligence|machine\s*learning|deep\s*learning|neural\s*network"
    r"|data\s*mining|classification|clustering|association\s*rule"
    r"|software\s*testing|requirement|use\s*case|UML|design\s*pattern"
    r"|security|encryption|authentication|firewall|cyber"
    r"|theory\s*of\s*computation|automata|grammar|turing\s*machine"
    r"|compiler|lexical|parsing|semantic\s*analysis"
    r"|computer\s*architecture|pipeline|cache|instruction\s*set"
    r"|management|lifecycle|governance|compliance"
    r"|ethics|privacy|policy|regulation|framework"
    r"|advantages|disadvantages|features|characteristics|types\s*of"
    r"|comparison|difference\s*between|explain|describe|discuss"
    r"|resource\s*allocation|load\s*balancing|scalability|availability"
    r"|server|cluster|data\s*center|distributed|replication"
    r"|cloud|elastic|on-demand|multi-tenant|abstraction"
    r")\b",
    re.IGNORECASE,
)


def detect_subject_nature(transcript: str, lecture_title: str) -> str:
    """
    Analyse the transcript and title to decide whether the lecture is
    primarily **mathematical** (formula/derivation-heavy) or **theoretical**
    (concept/explanation-heavy).

    Returns:
        "mathematical" or "theoretical"
    """
    sample = (lecture_title + " " + transcript[:3000]).lower()

    math_hits = len(_MATH_KEYWORDS.findall(sample))
    theory_hits = len(_THEORY_KEYWORDS.findall(sample))

    _prompt_logger.info(
        f"Subject detection — math_hits={math_hits}, theory_hits={theory_hits}, "
        f"title='{lecture_title}'"
    )

    # Default is "theoretical".  Only classify as mathematical when
    # domain-specific math/science keywords clearly dominate.
    if math_hits >= 4 and math_hits > theory_hits * 1.5:
        return "mathematical"
    return "theoretical"


# ---------------------------------------------------------------------------
# System prompt — adapts based on subject_nature
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT_BASE = """You are an expert university-level content creator
specialised in producing precise, well-structured study material
**strictly based on the source content provided below**.

CRITICAL RULES:
1. ONLY use facts, definitions, and examples that appear in the
   TEACHER-PROVIDED MATERIALS or the LECTURE TRANSCRIPT.
   Do NOT invent or add information from your own knowledge.
2. When the teacher's material contains diagrams, block diagrams, tables,
   or references, describe them accurately rather than guessing their content.
3. If the source material is insufficient to cover a topic, state that
   explicitly — do NOT fill in the gaps with external knowledge.
4. Prioritise teacher-provided materials over raw transcript when they
   overlap — the teacher's curated notes are the authoritative source.
5. Output all responses in valid JSON format as specified in the user prompt.
6. NEVER write in third person about the teacher or lecturer.
   DO NOT write "The teacher explains...", "The lecturer discusses...", etc.
   Write ALL content DIRECTLY as factual statements.
   BAD:  "The teacher explains that cloud computing uses virtualization."
   GOOD: "Cloud computing relies on virtualization to abstract physical
          hardware into shared, on-demand computing resources."
7. Write as if the notes ARE the authoritative reference — present
   information as direct definitions, explanations, and structured facts.
8. If Wikipedia context is provided, use it to fact-check and supplement
   accuracy but always prioritise the teacher's material."""

_SYSTEM_MATH_RULES = """
MATHEMATICAL / TECHNICAL FORMATTING RULES:
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

_SYSTEM_THEORY_RULES = """
THEORETICAL / CONCEPTUAL FORMATTING RULES:
9.  Focus on clear, well-structured prose — definitions, explanations,
    comparisons, workflows, and real-world examples.
10. Do NOT add mathematical formulas, derivations, or numerical examples
    unless they are explicitly present in the source material.
11. Use **bold labels** for definitions:  **Definition:** ...
12. Use bullet points or numbered lists to present features, advantages,
    disadvantages, types, and comparisons.
13. When comparing concepts, use structured comparisons (e.g. tables
    described in JSON, or point-by-point contrast).
14. Use precise domain-specific terminology (e.g. "horizontal scaling"
    not "adding more servers", "encapsulation" not "wrapping data").
15. For process flows or architectures, describe them step-by-step in
    clear numbered sequences.
16. Only use LaTeX ($...$) if a specific formula or equation actually
    appears in the source material — never invent formulas for
    theoretical topics."""


def get_system_prompt(subject_nature: str) -> str:
    """Return the system prompt tailored to the subject nature."""
    if subject_nature == "mathematical":
        return _SYSTEM_PROMPT_BASE + _SYSTEM_MATH_RULES
    return _SYSTEM_PROMPT_BASE + _SYSTEM_THEORY_RULES


# Keep a default for backward compatibility
SYSTEM_PROMPT = get_system_prompt("mathematical")


# ---------------------------------------------------------------------------
# Notes generation prompt — MATHEMATICAL subjects
# ---------------------------------------------------------------------------
_NOTES_PROMPT_MATH = """Generate COMPREHENSIVE, technically rigorous lecture notes
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
# Notes generation prompt — THEORETICAL subjects
# ---------------------------------------------------------------------------
_NOTES_PROMPT_THEORY = """Generate COMPREHENSIVE, well-structured lecture notes
for the lecture described below.

Your notes must be **strictly grounded** in the teacher's materials and the
lecture transcript.  Do NOT add information the teacher did not cover.

CRITICAL WRITING STYLE RULES:
- NEVER use third-person references to the teacher, lecturer, or professor.
- Write ALL content as DIRECT factual statements — definitions, explanations,
  comparisons, and structured descriptions.
- Focus on CLEAR PROSE, not formulas. Only include a formula or equation if
  it explicitly appears in the source material.
- Do NOT invent mathematical expressions, derivations, or numerical examples
  for topics that are conceptual in nature.
- Use bullet points and numbered lists for features, types, advantages,
  disadvantages, and step-by-step processes.
- Use structured comparisons when contrasting concepts.

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
    "summary": "A clear 4-5 sentence summary stating the core concepts,
                models, and key ideas covered. Write as direct factual
                statements.",
    "overview": "A paragraph explaining the significance of this topic —
                 where it fits in the broader field, its practical relevance,
                 and prerequisite knowledge assumed.",
    "sections": [
        {{
            "heading": "Descriptive heading (e.g. 'Cloud Deployment Models')",
            "content": "EXTENSIVE content (5-8 paragraphs) presenting clear
                        definitions, explanations, real-world examples, use
                        cases, and comparisons.  Write in precise, direct
                        prose.  Do NOT add formulas unless they appear in the
                        source material.",
            "subsections": [
                {{
                    "subheading": "Sub-topic (e.g. 'Public Cloud')",
                    "explanation": "Detailed explanation with characteristics,
                                     advantages, disadvantages, and examples."
                }}
            ],
            "key_points": [
                "Clear factual point — e.g. 'IaaS provides virtualized computing resources over the internet.'",
                "Key point 2",
                "Key point 3",
                "Key point 4"
            ],
            "examples": [
                "Real-world example from the source material",
                "Example 2"
            ],
            "comparisons": [
                {{
                    "items": ["Concept A", "Concept B"],
                    "criteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
                    "description": "Brief comparison summary"
                }}
            ],
            "applications": ["Practical application 1", "Application 2"]
        }}
    ],
    "key_takeaways": [
        "Core takeaway stated as a fact",
        "Takeaway 2",
        "Takeaway 3",
        "Takeaway 4"
    ],
    "important_concepts": [
        {{
            "concept": "Concept name",
            "explanation": "Clear, precise definition and explanation",
            "related_topics": ["Related concept 1", "Related concept 2"]
        }}
    ],
    "vocabulary": [
        {{"term": "Technical term", "definition": "Precise definition in context of this subject"}}
    ],
    "practice_questions": [
        "Define and explain: question 1",
        "Compare and contrast: question 2",
        "Describe the process of: question 3",
        "What are the advantages and disadvantages of: question 4"
    ],
    "further_reading": ["Topic / textbook chapter for further study"],
    "summary_diagram_description": "Description of a flowchart, architecture diagram, or conceptual map illustrating the key relationships"
}}

REQUIREMENTS:
- Create 5-8 DETAILED sections covering ALL major topics from the source material
- Each section must have 5-8 paragraphs of CLEAR, precise content
- Focus on definitions, explanations, comparisons, workflows, and examples
- Do NOT add formulas, derivations, or numerical examples unless they are
  explicitly present in the source material
- Include 4-6 key points per section, each stated as a factual statement
- Vocabulary section: 8-15 terms with precise definitions
- Practice questions: mix of definition, comparison, explanation, and analysis types
  (NOT numerical or derivation types unless the source has math content)
- Only include examples actually present in the source material
- Do NOT add outside facts or examples not present in the sources
- ZERO sentences should reference "the teacher", "the lecturer", or "the lecture"
"""


# ---------------------------------------------------------------------------
# Assignment generation prompt — MATHEMATICAL subjects
# ---------------------------------------------------------------------------
_ASSIGNMENT_PROMPT_MATH = """Generate a COMPREHENSIVE, technically rigorous practice
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
# Assignment generation prompt — THEORETICAL subjects
# ---------------------------------------------------------------------------
_ASSIGNMENT_PROMPT_THEORY = """Generate a COMPREHENSIVE practice assignment
for the lecture described below.

Every question must be **answerable using only the teacher's materials and
the lecture transcript**.  Do NOT create questions about topics not covered.

IMPORTANT: Generate ONLY subjective questions — short answer, long answer,
analytical, explanation, comparison, and application-type.
Do NOT generate any MCQs, true/false, or numerical/derivation questions
unless the source material explicitly contains mathematical content.

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
    "description": "Description covering learning objectives",
    "total_points": 200,
    "instructions": "Answer all questions with clear, structured explanations.
                     Use diagrams/flowcharts where relevant.",
    "questions": [
        {{
            "type": "short_answer",
            "question": "A concise question requiring a 3-5 sentence explanation
                         of a key concept, definition, or mechanism.",
            "expected_answer": "Model answer with precise definitions (3-5 sentences)",
            "keywords": ["important", "terms"],
            "hints": ["A helpful hint"],
            "points": 10,
            "difficulty": "easy",
            "topic": "Relevant topic area"
        }},
        {{
            "type": "explain",
            "question": "Explain [concept/process/architecture] in detail with
                         a real-world example.",
            "expected_answer": "Detailed explanation (5-8 sentences) with
                                practical examples",
            "keywords": ["key", "concepts"],
            "points": 15,
            "difficulty": "medium",
            "topic": "Relevant topic area"
        }},
        {{
            "type": "analytical",
            "question": "Compare [concept A] and [concept B] in terms of
                         [criterion 1], [criterion 2], and [criterion 3].",
            "expected_answer": "Structured comparison (6-10 sentences) with
                                clear criteria-based analysis",
            "rubric": "Clear criteria for evaluation",
            "points": 20,
            "difficulty": "medium",
            "topic": "Relevant topic area"
        }},
        {{
            "type": "long_answer",
            "question": "Comprehensive question requiring synthesis of multiple
                         concepts — definitions, architecture, advantages/
                         disadvantages, and real-world applications.",
            "rubric": "Detailed rubric: definitions, explanation, examples,
                        advantages, disadvantages, use cases",
            "expected_answer": "Comprehensive model answer covering all points",
            "points": 30,
            "difficulty": "hard",
            "minimum_words": 300,
            "topic": "Relevant topic area"
        }},
        {{
            "type": "application",
            "question": "Given the following scenario: [describe situation],
                         which [model/approach/architecture] would you
                         recommend and why?",
            "expected_answer": "Justified recommendation with reasoning",
            "solution_steps": ["Analyse requirements", "Evaluate options", "Recommend with justification"],
            "points": 25,
            "difficulty": "hard",
            "topic": "Relevant topic area"
        }},
        {{
            "type": "diagram",
            "question": "Draw and explain [architecture/workflow/process].
                         Label all components and describe the flow.",
            "expected_answer": "Description of diagram with labelled components
                                and data/control flow",
            "points": 15,
            "difficulty": "medium",
            "topic": "Relevant topic area"
        }}
    ],
    "bonus_section": [
        {{
            "type": "critical_thinking",
            "question": "A thought-provoking question — e.g. discuss trade-offs,
                         propose improvements, or analyse emerging trends.",
            "points": 10
        }}
    ]
}}

REQUIREMENTS:
- 5-6 Short answer / Define (easy-medium), 3-4 Explain (medium),
  2-3 Analytical / Compare (medium-hard), 2-3 Long answer (hard),
  1-2 Application / Scenario (hard), 1-2 Diagram (medium), 1-2 Bonus
- ABSOLUTELY NO MCQs or true/false questions
- Do NOT include numerical or derivation questions unless the source
  material explicitly contains mathematical formulas and calculations
- ALL questions must reference concepts from the source material
- Include model expected_answers for every question
- Total: 16-24 questions, 200 points
- Expected answers must be verifiable against the source content"""


# ---------------------------------------------------------------------------
# Flashcard generation prompt (Engineering / Technical)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Flashcards generation prompt — MATHEMATICAL subjects
# ---------------------------------------------------------------------------
_FLASHCARDS_PROMPT_MATH = """Generate COMPREHENSIVE, technically precise study
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
# Flashcards generation prompt — THEORETICAL subjects
# ---------------------------------------------------------------------------
_FLASHCARDS_PROMPT_THEORY = """Generate COMPREHENSIVE study flashcards for the
lecture described below.

Every card must test a concept, definition, process, architecture, comparison,
or key idea that appears in the teacher's materials or the lecture transcript.
Do NOT add facts from outside sources.

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
    "description": "Study flashcards for [topic]",
    "total_cards": 30,
    "cards": [
        {{
            "front": "What is [term / concept]?",
            "back": "Clear, precise definition (3-5 sentences) with a
                     real-world example.",
            "difficulty": "easy",
            "category": "Definitions & Fundamentals",
            "related_concepts": ["Related concept 1", "Related concept 2"]
        }},
        {{
            "front": "Explain how [process / mechanism / protocol] works.",
            "back": "Step-by-step explanation of the process, covering key
                     stages and their purpose.",
            "difficulty": "medium",
            "category": "Processes & Mechanisms",
            "related_concepts": ["Related topic"]
        }},
        {{
            "front": "Compare [concept A] vs [concept B].",
            "back": "A: [characteristic 1], [characteristic 2].\\n
                     B: [characteristic 1], [characteristic 2].\\n
                     Key difference: …\\n
                     When to use each: …",
            "difficulty": "medium",
            "category": "Comparisons"
        }},
        {{
            "front": "What are the advantages and disadvantages of [technology /
                      approach]?",
            "back": "Advantages: 1. … 2. … 3. …\\n
                     Disadvantages: 1. … 2. …\\n
                     Best suited for: …",
            "difficulty": "medium",
            "category": "Pros & Cons"
        }},
        {{
            "front": "In what real-world scenario would you use [concept]?",
            "back": "Scenario description + why this concept applies +
                     expected outcome.",
            "difficulty": "hard",
            "category": "Application & Use Cases"
        }},
        {{
            "front": "Describe the architecture / components of [system].",
            "back": "Component 1: purpose.\\n
                     Component 2: purpose.\\n
                     How they interact: …",
            "difficulty": "hard",
            "category": "Architecture & Design"
        }}
    ]
}}

REQUIREMENTS:
- Generate 25-35 flashcards covering ALL major concepts
- Categories should include:
  * Definitions & Fundamentals (8-10 cards) — clear definitions with examples
  * Processes & Mechanisms (4-6 cards) — how things work, step-by-step
  * Comparisons (4-6 cards) — contrast two or more concepts
  * Pros & Cons (3-4 cards) — advantages, disadvantages, trade-offs
  * Application & Use Cases (3-4 cards) — real-world scenarios
  * Architecture & Design (2-4 cards) — system components and interactions
- Do NOT force mathematical formulas, derivations, or numerical problems
  unless the source material explicitly contains them
- Every card's back side must reference content from the source material
- Difficulty split: Easy 30-35%, Medium 40-45%, Hard 20-25%
- Do NOT add supplementary information not found in the provided context"""


# ---------------------------------------------------------------------------
# Prompt formatters (subject-nature-aware)
# ---------------------------------------------------------------------------

def get_notes_prompt(
    transcript: str,
    context: str,
    lecture_title: str,
    subject_nature: str = "mathematical",
) -> str:
    """Format the notes generation prompt for the detected subject nature."""
    template = (
        _NOTES_PROMPT_MATH if subject_nature == "mathematical"
        else _NOTES_PROMPT_THEORY
    )
    return template.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )


def get_assignment_prompt(
    transcript: str,
    context: str,
    lecture_title: str,
    subject_nature: str = "mathematical",
) -> str:
    """Format the assignment generation prompt for the detected subject nature."""
    template = (
        _ASSIGNMENT_PROMPT_MATH if subject_nature == "mathematical"
        else _ASSIGNMENT_PROMPT_THEORY
    )
    return template.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )


def get_flashcards_prompt(
    transcript: str,
    context: str,
    lecture_title: str,
    subject_nature: str = "mathematical",
) -> str:
    """Format the flashcards generation prompt for the detected subject nature."""
    template = (
        _FLASHCARDS_PROMPT_MATH if subject_nature == "mathematical"
        else _FLASHCARDS_PROMPT_THEORY
    )
    return template.format(
        transcript=transcript[:15000],
        context=context[:10000],
        lecture_title=lecture_title,
    )


# ---------------------------------------------------------------------------
# Transcript Summarization Prompt (for two-pass strategy)
# ---------------------------------------------------------------------------
_TRANSCRIPT_SUMMARIZATION_PROMPT = """You are an expert at creating concise,
comprehensive lecture summaries that preserve all key concepts while removing
transcription noise (filler words, repetitions, false starts).

CRITICAL RULES:
1. Preserve ALL key technical concepts, definitions, theorems, and derivations
2. Remove transcription artifacts: "um", "uh", "like", "you know", filler
3. Condense repetitive explanations (remove duplicates, keep best version)
4. Remove off-topic tangents and personal anecdotes
5. Keep ALL examples, worked problems, and numerical results
6. Maintain logical flow and connections between concepts
7. Keep in first-pass form (no need for perfect prose, clarity > polish)

LECTURE TITLE: {lecture_title}

─────────────────────────────────
FULL LECTURE TRANSCRIPT:
{transcript}
─────────────────────────────────

Task: Summarize this lecture transcript to 60-70% of its original length,
removing noise while preserving ALL technical content.

Output format: Plain text (not JSON). Write as a cleaned, condensed version
of the lecture that could serve as study material.

Begin the summary:"""


def get_summarization_prompt(
    transcript: str,
    lecture_title: str,
) -> str:
    """Format the transcript summarization prompt."""
    return _TRANSCRIPT_SUMMARIZATION_PROMPT.format(
        transcript=transcript,
        lecture_title=lecture_title,
    )
