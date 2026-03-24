import { ArrowUpDown } from 'lucide-react';
import { TOP_LIMIT_OPTIONS } from '../lib/collections';

export default function CollectionToolbar({
    summary,
    helperText,
    sortValue,
    onSortChange,
    sortOptions,
    limitValue = '5',
    onLimitChange
}) {
    return (
        <section className="collection-toolbar">
            <div className="collection-toolbar__summary">
                <span className="collection-toolbar__eyebrow">Vista actual</span>
                <strong>{summary}</strong>
                <span>{helperText}</span>
            </div>

            <div className="collection-toolbar__controls">
                <label className="collection-toolbar__select">
                    <span>Orden</span>
                    <ArrowUpDown size={15} />
                    <select value={sortValue} onChange={event => onSortChange(event.target.value)}>
                        {sortOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="collection-toolbar__select">
                    <span>Top</span>
                    <select
                        value={limitValue}
                        onChange={event => onLimitChange(event.target.value)}
                    >
                        {TOP_LIMIT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
        </section>
    );
}
