import "katex/dist/katex.min.css"
import katex from "katex"
import { useMemo } from "react"

/**
 * Renders a string that may contain inline LaTeX ($...$) and
 * display LaTeX ($$...$$) by splitting on delimiters and rendering
 * each math segment with KaTeX.
 *
 * Non-math text is rendered as-is (with support for **bold** and \n).
 */
export function LatexRenderer({ text, className = "" }: { text: string; className?: string }) {
    const rendered = useMemo(() => renderLatexToHTML(text), [text])
    return <span className={className} dangerouslySetInnerHTML={{ __html: rendered }} />
}

/**
 * Block-level LaTeX renderer.  Same as LatexRenderer but wraps in <div>
 * and renders $$...$$ segments as display-mode (centered block equations).
 */
export function LatexBlock({ text, className = "" }: { text: string; className?: string }) {
    const rendered = useMemo(() => renderLatexToHTML(text), [text])
    return <div className={className} dangerouslySetInnerHTML={{ __html: rendered }} />
}

// ---------------------------------------------------------------------------
// Core rendering logic
// ---------------------------------------------------------------------------

function renderLatexToHTML(input: string): string {
    if (!input) return ""

    // We split on $$...$$ first (display math), then $...$ (inline math).
    // Regex: split by display math first to avoid greedy matching.
    const parts: string[] = []
    const remaining = input

    // Pattern for display math: $$...$$
    const displayRe = /\$\$([\s\S]+?)\$\$/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = displayRe.exec(remaining)) !== null) {
        // Push text before this match
        if (match.index > lastIndex) {
            parts.push(processInlineMath(remaining.slice(lastIndex, match.index)))
        }
        // Render the display math
        try {
            const html = katex.renderToString(match[1].trim(), {
                displayMode: true,
                throwOnError: false,
                trust: true,
            })
            parts.push(`<div class="katex-display-wrapper my-2">${html}</div>`)
        } catch {
            parts.push(`<code>${escapeHtml(match[0])}</code>`)
        }
        lastIndex = match.index + match[0].length
    }

    // Push any remaining text after the last display-math match
    if (lastIndex < remaining.length) {
        parts.push(processInlineMath(remaining.slice(lastIndex)))
    }

    return parts.join("")
}

/** Process inline $...$ math within a text segment (no display math). */
function processInlineMath(text: string): string {
    // Pattern for inline math: $...$ (not preceded/followed by $)
    const inlineRe = /(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+?)\$(?!\$)/g
    let result = ""
    let lastIdx = 0
    let m: RegExpExecArray | null

    while ((m = inlineRe.exec(text)) !== null) {
        if (m.index > lastIdx) {
            result += processPlainText(text.slice(lastIdx, m.index))
        }
        try {
            result += katex.renderToString(m[1].trim(), {
                displayMode: false,
                throwOnError: false,
                trust: true,
            })
        } catch {
            result += `<code>${escapeHtml(m[0])}</code>`
        }
        lastIdx = m.index + m[0].length
    }

    if (lastIdx < text.length) {
        result += processPlainText(text.slice(lastIdx))
    }

    return result
}

/** Minimal processing: bold (**...**), newlines, and HTML-escape. */
function processPlainText(text: string): string {
    let safe = escapeHtml(text)
    // **bold**
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // newlines
    safe = safe.replace(/\\n/g, "<br/>")
    safe = safe.replace(/\n/g, "<br/>")
    return safe
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}
