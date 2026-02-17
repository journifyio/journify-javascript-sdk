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

export type ConsentCategoryPreferences = {
    [K in typeof CONSENT_CATEGORIES[number]]?: boolean;
};

export type Consent = {
    categoryPreferences?: ConsentCategoryPreferences;
};

export type ConsentState = {
    consentMode: ConsentMode;
    consent: Consent;
}

export interface ConsentService {
    updateConsent(categoryPreferences: ConsentCategoryPreferences): void;
    hasConsent(destinationCategory: string): boolean;
    getConsent(): Consent;
}

export class ConsentServiceImpl implements ConsentService {
    private readonly consentState: ConsentState;

    constructor(
        country: string,
        initialConsent?: ConsentCategoryPreferences
    ) {
        const consentMode = this.getConsentMode(country);
        this.consentState = {
            consentMode,
            consent: {
                categoryPreferences: initialConsent ? { ...initialConsent } : {},
            }
        };
    }

    // Determine consent mode based on country
    private getConsentMode(country?: string): ConsentMode {
        const normalizedCountry = country?.trim().toUpperCase() || ''
        return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
    }

    public updateConsent(categoryPreferences: ConsentCategoryPreferences): void {
        for (const [category, granted] of Object.entries(categoryPreferences)) {
            if (CONSENT_CATEGORIES.includes(category as typeof CONSENT_CATEGORIES[number])) {
                this.consentState.consent.categoryPreferences[category] = granted;
            }
        }
    }

    public getConsent(): Consent {
        return this.consentState.consent;
    }

    // Method that checks if consent is given for the specified category
    public hasConsent(destinationCategory: string): boolean {
        const consentMode = this.consentState.consentMode;
        const categoryPreferences = this.consentState.consent.categoryPreferences;

        // If destination has no category configured or consent preferences are undefined or empty
        if (!destinationCategory || Object.keys(categoryPreferences || {}).length === 0) {
            return consentMode === RELAXED_MODE; // Assumes consent in relaxed mode, denies in strict mode
        }

        const isCategoryConsentGranted = categoryPreferences[destinationCategory];

        // If category has no explicit consent decision
        if (isCategoryConsentGranted === undefined) {
            return consentMode !== STRICT_MODE; // Strict mode requires explicit consent, relaxed mode assumes consent
        }

        return isCategoryConsentGranted;
    }
}