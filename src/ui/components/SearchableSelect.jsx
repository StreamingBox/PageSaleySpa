import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

function normalizeTerm(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export default function SearchableSelect({
    value,
    options,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    onChange,
    disabled = false
}) {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);

    const selectedOption = useMemo(
        () => options.find(option => String(option.value) === String(value)) || null,
        [options, value]
    );

    const filteredOptions = useMemo(() => {
        const term = normalizeTerm(deferredSearch);
        if (!term) return options;

        return options.filter(option =>
            normalizeTerm(option.searchText || option.label).includes(term)
        );
    }, [deferredSearch, options]);

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = event => {
            if (rootRef.current?.contains(event.target)) return;
            setOpen(false);
            setSearch('');
        };

        const onKeyDown = event => {
            if (event.key === 'Escape') {
                setOpen(false);
                setSearch('');
            }
        };

        window.addEventListener('mousedown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
    }, [open]);

    const toggleOpen = () => {
        if (disabled) {
            return;
        }

        setOpen(current => {
            const nextOpen = !current;
            if (!nextOpen) setSearch('');
            return nextOpen;
        });
    };

    const selectOption = option => {
        onChange(option.value);
        setOpen(false);
        setSearch('');
    };

    return (
        <div className={`searchable-select${open ? ' searchable-select--open' : ''}`} ref={rootRef}>
            <button
                className="searchable-select__trigger"
                type="button"
                onClick={toggleOpen}
                aria-expanded={open}
                disabled={disabled}
            >
                <span
                    className={`searchable-select__value${
                        selectedOption ? '' : ' searchable-select__value--placeholder'
                    }`}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={18} className="searchable-select__chevron" />
            </button>

            {open ? (
                <div className="searchable-select__popover">
                    <div className="searchable-select__search">
                        <Search size={16} />
                        <input
                            ref={inputRef}
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder={searchPlaceholder}
                        />
                    </div>

                    <div className="searchable-select__list" role="listbox">
                        {!filteredOptions.length ? (
                            <p className="searchable-select__empty">{emptyMessage}</p>
                        ) : (
                            filteredOptions.map(option => (
                                <button
                                    key={option.value}
                                    className={`searchable-select__option${
                                        String(option.value) === String(value)
                                            ? ' searchable-select__option--active'
                                            : ''
                                    }`}
                                    type="button"
                                    onClick={() => selectOption(option)}
                                >
                                    <strong>{option.label}</strong>
                                    {option.description ? (
                                        <span>{option.description}</span>
                                    ) : null}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
