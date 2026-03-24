export default function DataTable({ columns, rows, empty, rowKey, className = '' }) {
    if (!rows.length) {
        return empty;
    }

    return (
        <div className={`data-table ${className}`.trim()}>
            <table>
                <thead>
                    <tr>
                        {columns.map(column => (
                            <th key={column.key} className={column.align ? `is-${column.align}` : ''}>
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row[rowKey]}>
                            {columns.map(column => (
                                <td key={column.key} className={column.align ? `is-${column.align}` : ''}>
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
