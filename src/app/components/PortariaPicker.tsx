'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Ref } from 'react';
import { normalizeSearch } from '@/lib/search';
import ItemStatusBadge from './ItemStatusBadge';
import type { ItemStatus } from './ItemStatusBadge';

export interface Choice {
    id: number;
    name: string;
    details?: string;
    searchText?: string;
    status?: ItemStatus;
}

interface Props {
    label: string;
    options: Choice[];
    selected?: Choice;
    onSelect: (id?: number, viaKeyboard?: boolean) => void;
    onDefaultEnter?: () => void;
    inputRef?: Ref<HTMLInputElement>;
    queryValue?: string;
    onQueryChange?: (query: string) => void;
    placeholder?: string;
    searchShortcut?: boolean;
}

export default function PortariaPicker({ label, options, selected, onSelect, onDefaultEnter, inputRef, queryValue, onQueryChange, placeholder, searchShortcut }: Props) {
    const inputId = useId();
    const listId = inputId + '-options';
    const statusId = inputId + '-status';
    const activeRef = useRef<HTMLLIElement>(null);
    const [localQuery, setLocalQuery] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const query = queryValue ?? localQuery;
    const term = selected ? '' : normalizeSearch(query);
    const matches = options.filter(option =>
        normalizeSearch(option.searchText ?? [option.name, option.details].join(' ')).includes(term)
    ).slice(0, 8);
    const active = matches[activeIndex];
    const showList = expanded && matches.length > 0;

    useEffect(() => {
        activeRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex]);

    function updateQuery(value: string) {
        if (queryValue === undefined) setLocalQuery(value);
        onQueryChange?.(value);
    }

    function choose(option: Choice, viaKeyboard = false) {
        updateQuery('');
        setExpanded(false);
        setActiveIndex(-1);
        onSelect(option.id, viaKeyboard);
    }

    return (
        <div className="portaria-picker">
            <label className="portaria-field-label" htmlFor={inputId}>{label}</label>
            <div className="portaria-picker-input" data-search={searchShortcut || undefined} data-status={!!selected?.status || undefined}>
                {searchShortcut && (
                    <svg className="portaria-search-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                )}
                <input
                    ref={inputRef}
                    id={inputId}
                    className="input"
                    placeholder={placeholder}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-keyshortcuts={searchShortcut ? '/' : undefined}
                    aria-expanded={showList}
                    aria-controls={showList ? listId : undefined}
                    aria-describedby={selected?.status ? statusId : undefined}
                    aria-activedescendant={showList && active ? listId + '-' + active.id : undefined}
                    value={selected?.name ?? query}
                    onFocus={() => { setExpanded(true); setActiveIndex(-1); }}
                    onClick={() => setExpanded(true)}
                    onBlur={() => setExpanded(false)}
                    onChange={event => {
                        onSelect();
                        updateQuery(event.target.value);
                        setExpanded(true);
                        setActiveIndex(-1);
                    }}
                    onKeyDown={event => {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            if (!matches.length) return;
                            event.preventDefault();
                            setExpanded(true);
                            setActiveIndex(index => {
                                if (!expanded || index < 0) return event.key === 'ArrowDown' ? 0 : matches.length - 1;
                                const step = event.key === 'ArrowDown' ? 1 : -1;
                                return Math.max(0, Math.min(index + step, matches.length - 1));
                            });
                        } else if (event.key === 'Enter' && (expanded || onDefaultEnter)) {
                            event.preventDefault();
                            if (event.repeat || event.nativeEvent.isComposing) return;
                            const singleMatch = matches.length === 1 && (term || !onDefaultEnter);
                            const choice = expanded ? active ?? (singleMatch ? matches[0] : undefined) : undefined;
                            if (choice) choose(choice, true);
                            else if (!term) onDefaultEnter?.();
                        } else if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                            const hasQuery = query.trim().length > 0;
                            if (hasQuery && !expanded) return;

                            event.preventDefault();
                            setExpanded(false);
                            setActiveIndex(-1);
                            if (!hasQuery) event.currentTarget.blur();
                        }
                    }}
                />
                <span className="portaria-picker-indicator">
                    {selected?.status
                        ? <ItemStatusBadge id={statusId} status={selected.status} />
                        : searchShortcut && <kbd aria-hidden="true">/</kbd>}
                </span>
            </div>
            {showList && (
                <div className="portaria-popup">
                    <ul id={listId} role="listbox" aria-label={label} className="portaria-options">
                        {matches.map((option, index) => (
                            <li
                                key={option.id}
                                id={listId + '-' + option.id}
                                ref={index === activeIndex ? activeRef : undefined}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseDown={event => event.preventDefault()}
                                onClick={() => choose(option)}
                            >
                                <span className="portaria-option-copy">
                                    <strong>{option.name}</strong>
                                    {option.details && <small>{option.details}</small>}
                                </span>
                                {option.status && <ItemStatusBadge status={option.status} />}
                            </li>
                        ))}
                    </ul>
                    <div className="portaria-picker-keys">
                        <span><kbd>↑</kbd> <kbd>↓</kbd> navegam</span>
                        <span><kbd>Enter</kbd> seleciona</span>
                        <span><kbd>Esc</kbd> fecha</span>
                    </div>
                </div>
            )}
            {expanded && !matches.length && <small role="status">Nenhuma opção encontrada.</small>}
        </div>
    );
}
