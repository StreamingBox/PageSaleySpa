import { compareText } from './collections';

function startsWithDigit(value) {
    return /^\d/.test(String(value || '').trim());
}

function sortClientsForSelect(clients) {
    return [...clients].sort((left, right) => {
        const leftStartsWithDigit = startsWithDigit(left.name);
        const rightStartsWithDigit = startsWithDigit(right.name);

        if (leftStartsWithDigit !== rightStartsWithDigit) {
            return leftStartsWithDigit ? 1 : -1;
        }

        return compareText(left.name, right.name);
    });
}

export function buildClientSelectOptions(
    clients,
    { includeAll = false, allLabel = 'Todos los clientes', includeDescription = true } = {}
) {
    const options = sortClientsForSelect(clients).map(client => ({
        value: String(client.id),
        label: client.phone ? `${client.name} - ${client.phone}` : client.name,
        description: includeDescription
            ? [client.address, client.complemento].filter(Boolean).join(' · ') ||
              'Sin dirección registrada'
            : '',
        searchText: [client.name, client.phone, client.address, client.complemento]
            .filter(Boolean)
            .join(' ')
    }));

    if (!includeAll) {
        return options;
    }

    return [
        {
            value: '',
            label: allLabel,
            description: '',
            searchText: allLabel
        },
        ...options
    ];
}
