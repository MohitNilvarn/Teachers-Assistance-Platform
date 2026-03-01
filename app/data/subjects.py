"""
Predefined subject catalog per academic year.

Each year has two semesters. Each subject has 6 units by default.
Teachers pick ONE subject during onboarding; the platform auto-creates
a course record and 6 units for them.
"""

from typing import List, Dict, Any

UNIT_COUNT = 6

# ──────────────────────────────────────────────
# Subject catalog keyed by year → semester
# ──────────────────────────────────────────────

SUBJECTS: Dict[str, Dict[int, List[Dict[str, str]]]] = {
    "FE": {
        1: [
            {"code": "FE101", "name": "Engineering Mathematics I"},
            {"code": "FE102", "name": "Engineering Physics"},
            {"code": "FE103", "name": "Engineering Chemistry"},
            {"code": "FE104", "name": "Engineering Mechanics"},
            {"code": "FE105", "name": "Basic Electrical Engineering"},
        ],
        2: [
            {"code": "FE201", "name": "Engineering Mathematics II"},
            {"code": "FE202", "name": "Engineering Graphics"},
            {"code": "FE203", "name": "C Programming"},
            {"code": "FE204", "name": "Workshop Practice"},
            {"code": "FE205", "name": "Communication Skills"},
        ],
    },
    "SE": {
        3: [
            {"code": "SE301", "name": "Engineering Mathematics III"},
            {"code": "SE302", "name": "Data Structures"},
            {"code": "SE303", "name": "Digital Logic Design"},
            {"code": "SE304", "name": "Electronic Devices & Circuits"},
            {"code": "SE305", "name": "Object Oriented Programming"},
        ],
        4: [
            {"code": "SE401", "name": "Engineering Mathematics IV"},
            {"code": "SE402", "name": "Analysis of Algorithms"},
            {"code": "SE403", "name": "Computer Organization"},
            {"code": "SE404", "name": "Operating Systems"},
            {"code": "SE405", "name": "Discrete Mathematics"},
        ],
    },
    "TE": {
        5: [
            {"code": "TE501", "name": "Database Management Systems"},
            {"code": "TE502", "name": "Theory of Computation"},
            {"code": "TE503", "name": "Software Engineering"},
            {"code": "TE504", "name": "Computer Networks"},
            {"code": "TE505", "name": "Microprocessors"},
        ],
        6: [
            {"code": "TE601", "name": "Data Mining & Warehousing"},
            {"code": "TE602", "name": "Web Technology"},
            {"code": "TE603", "name": "Artificial Intelligence"},
            {"code": "TE604", "name": "Systems Programming"},
            {"code": "TE605", "name": "Elective I"},
        ],
    },
    "BE": {
        7: [
            {"code": "BE401", "name": "Radiation & Microwave Theory"},
            {"code": "BE402", "name": "VLSI Design and Technology"},
            {"code": "BE403", "name": "Cloud Computing"},
            {"code": "BE404", "name": "Elective - 3"},
            {"code": "BE405", "name": "Elective - 4"},
        ],
        8: [
            {"code": "BE406", "name": "Fiber Optic Communication"},
            {"code": "BE407", "name": "Elective - 5"},
            {"code": "BE408", "name": "Elective - 6"},
        ],
    },
}


def get_subjects_for_year(year: str) -> List[Dict[str, Any]]:
    """
    Return a flat list of subjects for a given year,
    each annotated with semester and default unit stubs.
    """
    semesters = SUBJECTS.get(year.upper(), {})
    result: List[Dict[str, Any]] = []
    for semester, subjects in semesters.items():
        for subj in subjects:
            result.append({
                "code": subj["code"],
                "name": subj["name"],
                "year": year.upper(),
                "semester": semester,
                "units": [
                    {"number": i, "title": f"Unit {i}"}
                    for i in range(1, UNIT_COUNT + 1)
                ],
            })
    return result


def get_subject_by_code(code: str) -> Dict[str, Any] | None:
    """Look up a single subject by its code."""
    for year, semesters in SUBJECTS.items():
        for semester, subjects in semesters.items():
            for subj in subjects:
                if subj["code"] == code:
                    return {
                        "code": subj["code"],
                        "name": subj["name"],
                        "year": year,
                        "semester": semester,
                        "units": [
                            {"number": i, "title": f"Unit {i}"}
                            for i in range(1, UNIT_COUNT + 1)
                        ],
                    }
    return None
