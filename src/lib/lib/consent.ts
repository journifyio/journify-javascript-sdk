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

export type Consent = typeof STRICT_MODE | typeof RELAXED_MODE;

export interface ConsentState {
    advertising?: boolean;
    analytics?: boolean;
    functional?: boolean;
    marketing?: boolean;
    personalization?: boolean;
}

export type ConsentConfiguration = {
    [customCategory: string]: {
        granted: boolean;
        mapsTo: (keyof ConsentState)[]
    }
};

export interface ConsentManager {
    getConsentMode(): Consent;
    getConsentState(): ConsentState;
    updateConsentState(newState: Partial<ConsentState>): void;
    hasConsent(categories: string[]): boolean;
    isConsentRequired(): boolean;
}

export class ConsentManagerImpl implements ConsentManager {
    private readonly consentMode: Consent;
    private consentState: ConsentState = {};
    private readonly consentConfiguration: ConsentConfiguration;

    constructor(
        consentMode: Consent,
        customCategoryMapping?: ConsentConfiguration
    ) {
        this.consentMode = consentMode;
        this.consentConfiguration = customCategoryMapping || {};
        this.consentState = this.mapConsentConfiguration(this.consentConfiguration);
    }

    public getConsentMode(): Consent {
        return this.consentMode;
    }

    public getConsentState(): ConsentState {
        return { ...this.consentState };
    }

    public updateConsentState(newState: Partial<ConsentState>): void {
        this.consentState = {
            ...this.consentState,
            ...newState
        };
    }

    public hasConsent(destination_categories: string[]): boolean {
        // In relaxed mode, assume consent if not explicitly denied
        if (this.consentMode === RELAXED_MODE && !this.consentState) {
            return true;
        }

        // Check each required consent category
        for (const category of destination_categories) {
            const categoryConsent = this.consentState[category];

            // If category consent is undefined
            if (categoryConsent === undefined) {
                if (this.consentMode === STRICT_MODE) {
                    return false; // Strict mode requires explicit consent
                }
                // Relaxed mode assumes consent when undefined
                continue;
            }

            // If category consent is explicitly false
            if (categoryConsent === false) {
                return false; // Both modes respect explicit denial
            }
        }

        return true;
    }

    public isConsentRequired(): boolean {
        return this.consentMode === STRICT_MODE;
    }

    // Map custom consent configuration to standard consent state
    private mapConsentConfiguration(config: ConsentConfiguration): ConsentState {
        const result: ConsentState = {};

        for (const [customCategory, { granted, mapsTo }] of Object.entries(config)) {
            if (Array.isArray(mapsTo)) {
                mapsTo.forEach(category => {
                    result[category] = granted;
                });
            }
        }

        return result;
    }
}

// Utility function to determine consent mode based on country
export function getConsentMode(country?: string): Consent {
    if (!country || country.trim() === '') {
        return STRICT_MODE;
    }

    const normalizedCountry = country.trim().toUpperCase();

    // Validate ISO 3166-1 alpha-2 format (2 uppercase letters)
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
        return STRICT_MODE; // Default to strict for invalid country codes
    }

    return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
}