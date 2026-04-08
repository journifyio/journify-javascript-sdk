const STRICT_MODE = 'strict';
const RELAXED_MODE = 'relaxed';

// GDPR applies to EU member states plus EEA countries and UK
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GDPR_COUNTRIES = new Set([
    // EU Member States
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    // EEA Countries (non-EU)
    'IS', 'LI', 'NO',
    // UK (post-Brexit but maintains GDPR-equivalent laws)
    'GB',
    // Switzerland (GDPR-equivalent: Federal Act on Data Protection)
    'CH'
]);

export const CONSENT_CATEGORIES = ['advertising', 'analytics', 'functional', 'marketing', 'personalization'] as const;

export type ConsentCategory = typeof CONSENT_CATEGORIES[number];

export type ConsentMode = typeof STRICT_MODE | typeof RELAXED_MODE;

export enum ConsentPreference {
    UNSPECIFIED = "CONSENT_PREFERENCE_UNSPECIFIED",
    GRANTED = "GRANTED",
    DENIED = "DENIED",
}

export type ConsentCategoryPreferences = {
    [K in typeof CONSENT_CATEGORIES[number]]?: ConsentPreference;
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
    hasConsent(destinationCategory: ConsentCategory): boolean;
    getConsent(): Consent;
}

const DEFAULT_CONSENT: ConsentCategoryPreferences = {
    advertising: ConsentPreference.UNSPECIFIED,
    analytics: ConsentPreference.UNSPECIFIED,
    functional: ConsentPreference.UNSPECIFIED,
    marketing: ConsentPreference.UNSPECIFIED,
    personalization: ConsentPreference.UNSPECIFIED,
};

export function resolveConsentMode(country?: string, workspaceConsentMode?: ConsentMode): ConsentMode {
    if (isConsentMode(workspaceConsentMode)) return workspaceConsentMode;
    const normalizedCountry = country?.trim().toUpperCase() || '';
    return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
}

function isConsentMode(value?: string): value is ConsentMode {
    return value === STRICT_MODE || value === RELAXED_MODE;
}

export class ConsentServiceImpl implements ConsentService {
    private readonly consentState: ConsentState;

    constructor(
        consentMode: ConsentMode,
        initialConsent?: ConsentCategoryPreferences
    ) {
        this.consentState = {
            consentMode,
            consent: {
                categoryPreferences: { ...DEFAULT_CONSENT, ...initialConsent },
            }
        };
    }

    public updateConsent(categoryPreferences: ConsentCategoryPreferences): void {
        for (const [category, preference] of Object.entries(categoryPreferences)) {
            if (CONSENT_CATEGORIES.includes(category as typeof CONSENT_CATEGORIES[number])) {
                this.consentState.consent.categoryPreferences[category] = preference;
            }
        }
    }

    public getConsent(): Consent {
        return this.consentState.consent;
    }

    // Method that checks if consent is given for the specified category
    public hasConsent(destinationCategory: ConsentCategory): boolean {
        const consentMode = this.consentState.consentMode;
        const categoryPreferences = this.consentState.consent.categoryPreferences;

        if (!destinationCategory) {
            return consentMode === RELAXED_MODE;
        }

        const preference = categoryPreferences[destinationCategory];

        if (preference === ConsentPreference.GRANTED) return true;
        if (preference === ConsentPreference.DENIED) return false;

        // Anything else (UNSPECIFIED or unrecognized value) falls back to mode
        return consentMode === RELAXED_MODE;
    }
}