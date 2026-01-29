import {CONSENT_STATE_PERSISTENCE_KEY, Store} from "../store/store";

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

const CONSENT_CATEGORIES = ['advertising', 'analytics', 'functional', 'marketing', 'personalization'] as const;

export type ConsentMode = typeof STRICT_MODE | typeof RELAXED_MODE;

export type CategoryPreferences = {
    [K in typeof CONSENT_CATEGORIES[number]]?: boolean;
};

export type Consent = {
    categoryPreferences?: CategoryPreferences;
};

type ConsentState = {
    consentMode: ConsentMode;
    consent: Consent;
    categoryMappings: {
        [customCategory: string]: (keyof CategoryPreferences)[];
    }
}

export type ConsentConfiguration = {
    [customCategory: string]: {
        granted: boolean;
        mapsTo?: (keyof CategoryPreferences)[]
    }
};

export type ConsentUpdate = {
    [customCategory: string]: boolean;
};

export interface ConsentManager {
    getConsentState(): ConsentState;

    updateConsentState(consentUpdate: ConsentUpdate, updatedMappings?: { [key: string]: (keyof CategoryPreferences)[] }): void;

    hasConsent(categories: string[]): boolean;
}

export class ConsentManagerImpl implements ConsentManager {
    private readonly consentState: ConsentState;
    private readonly store: Store;

    constructor(
        consentMode: ConsentMode,
        consentConfiguration?: ConsentConfiguration,
        store?: Store
    ) {
        this.store = store;

        const persisted = this.loadFromStore();

        // Initialize with current mode and defaults
        this.consentState = {
            consentMode,
            consent: { categoryPreferences: {} },
            categoryMappings: {}
        };

        // Preserve persisted consent/mappings if available
        if (persisted) {
            this.consentState.consent.categoryPreferences = persisted.consent?.categoryPreferences ?? {};
            this.consentState.categoryMappings = persisted.categoryMappings ?? {};
        }

        // Apply new configuration if provided
        if (consentConfiguration) {
            this.setConsentFromConfiguration(consentConfiguration);
        }

        this.saveToStore();

    }

    private loadFromStore(): ConsentState | null {
        if (!this.store) return null;
        return this.store.get(CONSENT_STATE_PERSISTENCE_KEY)
    }

    private saveToStore(): void {
        if (!this.store) return;
        if (this.consentState && Object.keys(this.consentState).length > 0) {
            this.store.set(CONSENT_STATE_PERSISTENCE_KEY, this.consentState);
        }
    }

    private setConsentFromConfiguration(config: ConsentConfiguration): void {
        for (const [customCategory, {granted, mapsTo}] of Object.entries(config)) {
            // Set up mappings
            if (mapsTo && Array.isArray(mapsTo)) {
                this.consentState.categoryMappings[customCategory] = mapsTo;
            } else if (CONSENT_CATEGORIES.includes(customCategory as keyof CategoryPreferences)) {
                this.consentState.categoryMappings[customCategory] = [customCategory as keyof CategoryPreferences];
            } else {
                console.warn(
                    `[Journify] Invalid consent configuration: "${customCategory}" must either provide
                     a "mapsTo" array or be one of: ${CONSENT_CATEGORIES.join(', ')}. Skipping this category.`
                );
                continue;
            }

            // Apply consent values based on mappings
            this.updateConsentForCategory(customCategory, granted);
        }
    }

    private updateConsentForCategory(customCategory: string, granted: boolean): void {
        const mappedCategories = this.consentState.categoryMappings[customCategory];
        if (mappedCategories) {
            if (!this.consentState.consent.categoryPreferences) {
                this.consentState.consent.categoryPreferences = {};
            }
            mappedCategories.forEach(category => {
                this.consentState.consent.categoryPreferences[category] = granted;
            });
        }
    }

    public getConsentState(): ConsentState {
        return {...this.consentState};
    }

    // Method to update consent state with new granted statuses and optional updated category mappings
    public updateConsentState(
        consentUpdate: ConsentUpdate,
        updatedMappings?: { [key: string]: (keyof CategoryPreferences)[] }): void {

        // Update mappings if provided
        if (updatedMappings) {
            for (const [customCategory, standardCategories] of Object.entries(updatedMappings)) {
                this.consentState.categoryMappings[customCategory] = standardCategories;
            }
        }

        // Update consent values
        for (const [customCategory, granted] of Object.entries(consentUpdate)) {
            this.updateConsentForCategory(customCategory, granted);
        }

        this.saveToStore();
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

// Utility function to determine consent mode based on country
export function getConsentMode(country?: string): ConsentMode {
    if (!country || country.trim() === '') {
        return RELAXED_MODE; // Default to relaxed if country is not provided
    }

    const normalizedCountry = country.trim().toUpperCase();

    // Validate ISO 3166-1 alpha-2 format (2 uppercase letters)
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
        return RELAXED_MODE; // Default to relaxed for invalid country codes
    }

    return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
}