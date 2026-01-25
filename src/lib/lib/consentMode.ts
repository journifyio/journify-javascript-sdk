const STRICT_MODE = 'strict';
const RELAXED_MODE = 'relaxed';

// GDPR applies to EU member states plus EEA countries and UK
const GDPR_COUNTRIES = new Set([
    // EU Member States
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    // EEA Countries (non-EU)
    'IS', 'LI', 'NO',
    // UK (post-Brexit but maintains GDPR-equivalent laws)
    'GB'
]);


export type ConsentMode = typeof STRICT_MODE | typeof RELAXED_MODE;

export interface ConsentCategoryState {
    advertising?: boolean;
    analytics?: boolean;
    functional?: boolean;
    marketing?: boolean;
    personalization?: boolean;
}

export type ConsentCategoryMapping = {
    [customCategory: string]: (keyof ConsentCategoryState)[]
};


export function mapCustomConsent(
    userConsent: Record<string, boolean>,
    customCategoryMapping: ConsentCategoryMapping
): ConsentCategoryState {
    const result: ConsentCategoryState = {};

    for (const [customCategory, granted] of Object.entries(userConsent)) {
        const standardCategories = customCategoryMapping[customCategory];
        if (standardCategories && Array.isArray(standardCategories)) {
            standardCategories.forEach(category => {
                result[category] = granted;
            });
        }
    }

    return result;
}

export function getConsentMode(country?: string): ConsentMode {
    if (!country || country.trim() === '') {
        return STRICT_MODE;
    }

    const normalizedCountry = country.trim().toUpperCase();

    // Validate ISO 3166-1 alpha-2 format (2 uppercase letters)
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
        return STRICT_MODE; // Default to strict for invalid country codes
    }

    const countryCode = country.trim().toUpperCase();
    return GDPR_COUNTRIES.has(countryCode) ? STRICT_MODE : RELAXED_MODE;
}

export function isConsentGranted(
    consentMode: ConsentMode,
    consent?: ConsentCategoryState,
    destinationCategories?: (keyof ConsentCategoryState)[]
): boolean {
    // When no consent is provided
    if (!consent) {
        return consentMode === RELAXED_MODE;
    }

    // Check each required consent category for this destination
    for (const category of destinationCategories) {
        const categoryConsent = consent[category];

        // If category consent is undefined
        if (categoryConsent === undefined) {
            if (consentMode === STRICT_MODE) {
                return false; // Strict mode requires explicit consent
            }
            // Relaxed mode assumes consent when undefined
            continue;
        }

        // If category consent is explicitly false
        if (categoryConsent === false) {
            return false; // Both modes respect explicit denial
        }

        // categoryConsent === true, continue checking other categories
    }

    return true;
}