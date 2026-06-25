import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, X } from 'lucide-react'

/**
 * CustomSelect — animated, searchable dropdown replacing native <select>.
 * Props:
 *   value        — current selected value (string)
 *   onChange     — function(value) called when selection changes
 *   options      — array of strings OR array of { value, label, sub? }
 *   placeholder  — optional placeholder label shown when no value
 *   searchable   — bool (default true), shows a search input inside the dropdown
 *   searchPlaceholder — string
 *   error        — bool, adds error border
 *   disabled     — bool
 *   id           — optional id for the trigger button
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder,
  searchable = true,
  searchPlaceholder = 'Search...',
  error,
  disabled,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [panelStyle, setPanelStyle] = useState({})
  const [isPositioned, setIsPositioned] = useState(false)

  const containerRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)

  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )

  const filtered = query.trim()
    ? normalised.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(query.toLowerCase()))
      )
    : normalised

  const selectedLabel = normalised.find((o) => o.value === value)?.label ?? placeholder ?? ''

  // Position panel below trigger, flip if needed
  const reposition = useCallback(() => {
    if (!containerRef.current) return
    const trigger = containerRef.current.getBoundingClientRect()
    const panelH = 300 // approximate max
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = trigger.bottom + 4
    let left = trigger.left
    const width = Math.max(trigger.width, 220)

    if (top + panelH > vh - 12) top = trigger.top - panelH - 4
    if (left + width > vw - 12) left = vw - width - 12
    if (left < 12) left = 12

    setPanelStyle({ position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${width}px`, zIndex: 9999 })
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setFocusedIdx(-1)
      setIsPositioned(false)
      requestAnimationFrame(() => {
        reposition()
        setIsPositioned(true)
        if (searchable) searchRef.current?.focus()
      })
    } else {
      setIsPositioned(false)
    }
  }, [open, searchable, reposition])

  useEffect(() => {
    if (!open) return
    const handle = () => reposition()
    window.addEventListener('scroll', handle, true)
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle, true)
      window.removeEventListener('resize', handle)
    }
  }, [open, reposition])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        // Check if click is inside the fixed panel (which is outside container in DOM)
        const panel = document.querySelector('.prov-custom-select-dropdown[data-open="true"]')
        if (panel && panel.contains(e.target)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard navigation
  const handleTriggerKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }

  const handleSearchKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (focusedIdx >= 0 && filtered[focusedIdx]) {
          onChange(filtered[focusedIdx].value)
          setOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      default:
        break
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (open && listRef.current && focusedIdx >= 0) {
      const item = listRef.current.children[focusedIdx]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [focusedIdx, open])

  return (
    <div
      className={[
        'prov-custom-select',
        open ? 'prov-custom-select--open' : '',
        error ? 'prov-custom-select--error' : '',
        disabled ? 'prov-custom-select--disabled' : '',
      ].filter(Boolean).join(' ')}
      ref={containerRef}
    >
      <button
        id={id}
        type="button"
        className="prov-custom-select-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={`prov-custom-select-value${!value && placeholder ? ' prov-custom-select-placeholder' : ''}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={15} className="prov-custom-select-chevron" />
      </button>

      {open && isPositioned && createPortal(
        <div
          className="prov-custom-select-dropdown"
          data-open="true"
          role="listbox"
          style={panelStyle}
        >
          {/* Search bar */}
          {searchable && (
            <div className="prov-custom-select-search">
              <Search size={13} className="prov-custom-select-search-icon" />
              <input
                ref={searchRef}
                type="text"
                className="prov-custom-select-search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setFocusedIdx(0) }}
                onKeyDown={handleSearchKeyDown}
              />
              {query && (
                <button
                  type="button"
                  className="prov-custom-select-search-clear"
                  onClick={() => { setQuery(''); searchRef.current?.focus() }}
                  tabIndex={-1}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <ul className="prov-custom-select-list" ref={listRef}>
            {filtered.length === 0 ? (
              <li className="prov-custom-select-empty">No results found</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  className={[
                    'prov-custom-select-option',
                    opt.value === value ? 'prov-custom-select-option--selected' : '',
                    idx === focusedIdx ? 'prov-custom-select-option--focused' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setFocusedIdx(idx)}
                >
                  <div className="prov-custom-select-option-body">
                    <span className="prov-custom-select-option-label">{opt.label}</span>
                    {opt.sub && <span className="prov-custom-select-option-sub">{opt.sub}</span>}
                  </div>
                  {opt.value === value && (
                    <Check size={13} className="prov-custom-select-check" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
