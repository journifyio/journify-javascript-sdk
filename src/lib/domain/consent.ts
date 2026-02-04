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
    country: string
};

export type ConsentState = {
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

export interface ConsentService {
    updateConsentState(
        consentUpdate: ConsentUpdate,
        updatedMappings?: { [key: string]: (keyof CategoryPreferences)[] }): void;
    hasConsent(categories: string[]): boolean;
    getConsent(): Consent;
}

export class ConsentServiceImpl implements ConsentService {
    private readonly consentState: ConsentState;

    constructor(
        country: string,
        consentConfiguration?: ConsentConfiguration
    ) {
        const consentMode = this.getConsentMode(country);
        this.consentState = {
            consentMode,
            consent: { categoryPreferences: {}, country },
            categoryMappings: {}
        };

        if (consentConfiguration) {
            this.setConsentFromConfiguration(consentConfiguration);
        }
    }

    // Determine consent mode based on country
    private getConsentMode(country?: string): ConsentMode {
        const normalizedCountry = country?.trim().toUpperCase() || ''
        return GDPR_COUNTRIES.has(normalizedCountry) ? STRICT_MODE : RELAXED_MODE;
    }

    private setConsentFromConfiguration(config: ConsentConfiguration): void {
        // Keep track of already mapped Journify categories to avoid duplicates
        const mappedJournifyCategories = new Set<string>();

        for (const [customCategory, {granted, mapsTo}] of Object.entries(config)) {
            // Collects categories that pass validation
            let validCategories: (keyof CategoryPreferences)[] = [];
            const isStandardCategory = CONSENT_CATEGORIES.includes(customCategory as keyof CategoryPreferences);

            if (isStandardCategory) {
                // Standard category maps directly to itself
                const category = customCategory as keyof CategoryPreferences;
                if (mappedJournifyCategories.has(category)) {
                    console.warn(
                        `[Journify] Category "${category}" is already mapped. Skipping duplicate.`
                    );
                } else {
                    validCategories = [category];
                }
            } else if (!mapsTo || !Array.isArray(mapsTo)) {
                // Not a standard category and no valid mapsTo array
                console.warn(
                    `[Journify] Invalid consent configuration: "${customCategory}" must either provide a
                    "mapsTo" array or be one of: ${CONSENT_CATEGORIES.join(', ')}. Skipping.`
                );
            } else {
                // Validate each category in mapsTo
                for (const category of mapsTo) {
                    if (!CONSENT_CATEGORIES.includes(category)) {
                        console.warn(
                            `[Journify] "${category}" in mapsTo for "${customCategory}" is not a valid Journify category. Skipping.`
                        );
                    } else if (mappedJournifyCategories.has(category)) {
                        console.warn(
                            `[Journify] Category "${category}" is already mapped. Skipping duplicate mapping from "${customCategory}".`
                        );
                    } else {
                        validCategories.push(category);
                    }
                }
            }

            // Apply valid mappings
            if (validCategories.length > 0) {
                validCategories.forEach(category => mappedJournifyCategories.add(category));
                this.consentState.categoryMappings[customCategory] = validCategories;
                this.updateConsentForCategory(customCategory, granted);
            }
        }
    }

    private updateConsentForCategory(customCategory: string, granted: boolean): void {
        const mappedCategories = this.consentState.categoryMappings[customCategory];
        if (mappedCategories) {
            mappedCategories.forEach(category => {
                this.consentState.consent.categoryPreferences[category] = granted;
            });
        }
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