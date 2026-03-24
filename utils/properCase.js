const SMALL_WORDS = new Set([
    'a',
    'al',
    'con',
    'de',
    'del',
    'e',
    'el',
    'en',
    'la',
    'las',
    'los',
    'o',
    'para',
    'por',
    'u',
    'y'
]);

function capitalizeToken(token, isFirstWord) {
    const normalized = String(token || '').trim();
    if (!normalized) return '';

    const lower = normalized.toLocaleLowerCase('es-CO');

    if (!isFirstWord && SMALL_WORDS.has(lower)) {
        return lower;
    }

    if (lower.length === 1) {
        return lower.toLocaleUpperCase('es-CO');
    }

    return lower[0].toLocaleUpperCase('es-CO') + lower.slice(1);
}

function formatCompoundWord(word, isFirstWord) {
    return word
        .split('-')
        .map((part, index) => capitalizeToken(part, isFirstWord && index === 0))
        .join('-');
}

function formatProperCase(value) {
    const source = String(value || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';

    let wordIndex = 0;

    return source
        .split(' ')
        .map(word => {
            const formatted = formatCompoundWord(word, wordIndex === 0);
            wordIndex += 1;
            return formatted;
        })
        .join(' ');
}

module.exports = {
    formatProperCase
};
