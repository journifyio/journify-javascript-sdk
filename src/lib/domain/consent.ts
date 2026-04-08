const STRICT_MODE = 'STRICT';
const RELAXED_MODE = 'RELAXED';

// GDPR applies to EU member states plus EEA countries and UK
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

export const CONSENT_CATEGORIES = ['ADVERTISING', 'ANALYTICS', 'FUNCTIONAL', 'MARKETING', 'PERSONALIZATION'] as const;

export type ConsentCategory = Lowercase<typeof CONSENT_CATEGORIES[number]>;

export type ConsentMode = typeof STRICT_MODE | typeof RELAXED_MODE;

export enum ConsentPreference {
    UNSPECIFIED = "CONSENT_PREFERENCE_UNSPECIFIED",
    GRANTED = "GRANTED",
    DENIED = "DENIED",
}

export type ConsentCategoryPreferences = {
    [K in ConsentCategory]: ConsentPreference;
};

export type Consent = {
    categoryPreferences?: ConsentCategoryPreferences;
};

export type ConsentState = {
    consentMode: ConsentMode;
    consent: Consent;
}

export interface ConsentService {
    updateConsent(categoryPreferences: Partial<ConsentCategoryPreferences>): void;
    hasConsent(destinationCategory: ConsentCategory | null | undefined): boolean;
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
    if (isValidConsentMode(workspaceConsentMode)) return workspaceConsentMode;
    const normalizedCountry = country?.trim().toUpperCase() || '';
    return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
}

export function normalizeConsentCategory(value?: string): ConsentCategory | undefined {
    const lower = value?.trim().toLowerCase();
    return CONSENT_CATEGORIES.includes(lower?.toUpperCase() as typeof CONSENT_CATEGORIES[number])
        ? lower as ConsentCategory
        : undefined;
}

function isValidConsentMode(value?: string): value is ConsentMode {
    return value === STRICT_MODE || value === RELAXED_MODE;
}

export class ConsentServiceImpl implements ConsentService {
    private readonly consentState: ConsentState;

    constructor(
        consentMode: ConsentMode,
        initialConsent?: Partial<ConsentCategoryPreferences>
    ) {
        this.consentState = {
            consentMode,
            consent: {
                categoryPreferences: { ...DEFAULT_CONSENT, ...initialConsent },
            }
        };
    }

    public updateConsent(categoryPreferences: Partial<ConsentCategoryPreferences>): void {
        for (const [category, preference] of Object.entries(categoryPreferences)) {
            const normalized = normalizeConsentCategory(category);
            if (normalized) {
                this.consentState.consent.categoryPreferences[normalized] = preference;
            }
        }
    }

    public getConsent(): Consent {
        return this.consentState.consent;
    }

    public hasConsent(destinationCategory: ConsentCategory | null | undefined): boolean {
        const consentMode = this.consentState.consentMode;
        const categoryPreferences = this.consentState.consent.categoryPreferences;

        if (!destinationCategory) {
            return consentMode === RELAXED_MODE;
        }

        const preference = categoryPreferences[destinationCategory];

        if (preference === ConsentPreference.DENIED) return false;
        return preference === ConsentPreference.GRANTED || consentMode === RELAXED_MODE;
    }
}
