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

export const CONSENT_CATEGORIES = ['advertising', 'analytics', 'functional', 'marketing', 'personalization'] as const;

export type ConsentMode = typeof STRICT_MODE | typeof RELAXED_MODE;

export type CategoryPreferences = {
    [K in typeof CONSENT_CATEGORIES[number]]?: boolean;
};

export type Consent = {
    categoryPreferences?: CategoryPreferences;
    country: string
};

export type ConsentState = {
    consentMode: ConsentMode;
    consent: Consent;
}

export interface ConsentService {
    updateConsent(categoryPreferences: CategoryPreferences): void;
    hasConsent(categories: string[]): boolean;
    getConsent(): Consent;
}

export class ConsentServiceImpl implements ConsentService {
    private readonly consentState: ConsentState;

    constructor(
        country: string,
        initialConsent?: CategoryPreferences
    ) {
        const consentMode = this.getConsentMode(country);
        this.consentState = {
            consentMode,
            consent: {
                categoryPreferences: initialConsent ? { ...initialConsent } : {},
                country
            }
        };
    }

    // Determine consent mode based on country
    private getConsentMode(country?: string): ConsentMode {
        const normalizedCountry = country?.trim().toUpperCase() || ''
        return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
    }

    public updateConsent(categoryPreferences: CategoryPreferences): void {
        for (const [category, granted] of Object.entries(categoryPreferences)) {
            if (CONSENT_CATEGORIES.includes(category as typeof CONSENT_CATEGORIES[number])) {
                this.consentState.consent.categoryPreferences[category] = granted;
            }
        }
    }

    public getConsent(): Consent {
        return this.consentState.consent;
    }

    // Method that checks if consent is given for the specified categories
    public hasConsent(destination_categories: string[]): boolean {
        const consentMode = this.consentState.consentMode;
        const categoryPreferences = this.consentState.consent.categoryPreferences;

        // If destination has no categories configured or consent preferences are undefined or empty
        if (!destination_categories || destination_categories.length === 0
            || !categoryPreferences || Object.keys(categoryPreferences).length === 0) {
            return consentMode === RELAXED_MODE; // Assumes consent in relaxed mode, denies in strict mode
        }

        // Check each required consent category
        for (const category of destination_categories) {
            const categoryConsent = categoryPreferences[category];

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
                return false;
            }
        }

        return true;
    }
}