# File: app/ai/llm.py
"""
Groq LLM wrapper using LangChain.
"""
import re
import json
from typing import Optional, Dict, Any
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("TAP.LLM")


def _fix_latex_in_json(raw: str) -> str:
    """
    Fix LaTeX backslash commands that break JSON parsing.

    LLMs output LaTeX like \\frac, \\lambda, \\text, \\, inside JSON strings.
    Single backslashes create invalid or misinterpreted JSON escapes:
        \\f → formfeed    — corrupts \\frac, \\forall
        \\t → tab         — corrupts \\text, \\theta, \\times
        \\b → backspace   — corrupts \\beta, \\bar
        \\n → newline     — corrupts \\nu, \\nabla
        \\r → CR          — corrupts \\rho, \\right
        \\, \\; \\! etc.  — invalid JSON escapes (LaTeX spacing)

    Strategy: double every single backslash that is NOT a standard JSON
    structural escape ( \\", \\\\, \\/ ) or a Unicode escape ( \\uXXXX ).
    """
    return re.sub(
        r'(?<!\\)\\(?!["\\/]|u[0-9a-fA-F]{4})',
        r'\\\\',
        raw,
    )


def _parse_json_safe(text: str) -> Dict[str, Any]:
    """
    Parse JSON text, automatically fixing LaTeX backslashes on failure.
    """
    # Fast path: try parsing as-is
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fix LaTeX backslashes and retry
    fixed = _fix_latex_in_json(text)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Last resort: also strip trailing commas before } or ]
    fixed2 = re.sub(r',\s*([}\]])', r'\1', fixed)
    return json.loads(fixed2)

# Global LLM instance
_llm: Optional[ChatGroq] = None


def get_llm() -> ChatGroq:
    """Get or create the Groq LLM instance."""
    global _llm
    
    if _llm is None:
        logger.info(f"Initializing Groq LLM with model: {settings.GROQ_MODEL}")
        
        _llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model=settings.GROQ_MODEL,
            temperature=0.7,
            max_tokens=16384,
        )
        
        logger.info("Groq LLM initialized successfully.")
    
    return _llm


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def generate_text(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096
) -> str:
    """
    Generate text using the LLM.
    
    Args:
        prompt: The user prompt
        system_prompt: Optional system prompt for context
        temperature: Creativity setting (0-1)
        max_tokens: Maximum tokens in response
    
    Returns:
        Generated text
    """
    llm = get_llm()
    
    messages = []
    if system_prompt:
        messages.append(SystemMessage(content=system_prompt))
    messages.append(HumanMessage(content=prompt))
    
    try:
        response = await llm.ainvoke(messages)
        return response.content
    except Exception as e:
        logger.error(f"LLM generation error: {str(e)}")
        raise


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=4, max=30)
)
async def generate_json(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.5
) -> Dict[str, Any]:
    """
    Generate structured JSON output using the LLM.
    
    Handles LaTeX-in-JSON escaping automatically: the LLM often returns
    \\frac, \\text, \\lambda etc. which are invalid JSON escapes.  We fix
    them before parsing.
    
    Args:
        prompt: The user prompt requesting JSON output
        system_prompt: Optional system prompt
        temperature: Creativity setting (lower for more consistent JSON)
    
    Returns:
        Parsed JSON dictionary
    """
    llm = get_llm()
    
    # Add JSON instruction to system prompt
    json_instruction = (
        "\n\nYou must respond with valid JSON only. No markdown, no explanations, just the JSON object."
        "\nIMPORTANT: For LaTeX backslashes inside JSON strings, use DOUBLE backslashes."
        "\nFor example write \\\\frac not \\frac, \\\\lambda not \\lambda, \\\\text not \\text."
    )
    
    full_system = (system_prompt or "") + json_instruction
    
    messages = [
        SystemMessage(content=full_system),
        HumanMessage(content=prompt)
    ]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content
        
        # Clean up any markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        content = content.strip()
        
        return _parse_json_safe(content)
    except json.JSONDecodeError as e:
        error_msg = str(e)
        raw_snippet = content[:500] if content else "(empty)"
        logger.error(f"LLM JSON parse error: {error_msg}")
        logger.error(f"Raw LLM output snippet: {raw_snippet}")
        raise
    except Exception as e:
        logger.error(f"LLM JSON generation error: {str(e)}")
        raise


async def estimate_tokens(text: str) -> int:
    """
    Estimate token count for text.
    Rough approximation: ~4 characters per token.
    """
    return len(text) // 4
