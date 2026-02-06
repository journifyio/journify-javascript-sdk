import { CategoryPreferences } from "../../domain/consent";

/**
 * Google Consent Mode v2 consent signals.
 * Values can be 'granted', 'denied', or boolean.
 * @see https://developers.google.com/tag-platform/security/guides/consent
 */
export type GoogleConsentV2 = {
    /** Controls storage (such as cookies) related to advertising */
    ad_storage?: 'granted' | 'denied' | boolean;
    /** Controls whether user data can be sent to Google for advertising purposes */
    ad_user_data?: 'granted' | 'denied' | boolean;
    /** Controls personalized advertising */
    ad_personalization?: 'granted' | 'denied' | boolean;
    /** Controls storage (such as cookies) related to analytics */
    analytics_storage?: 'granted' | 'denied' | boolean;
    /** Controls storage related to functionality (e.g., language settings) */
    functionality_storage?: 'granted' | 'denied' | boolean;
    /** Controls storage related to personalization (e.g., video recommendations) */
    personalization_storage?: 'granted' | 'denied' | boolean;
    /** Controls storage related to security (e.g., authentication, fraud prevention) */
    security_storage?: 'granted' | 'denied' | boolean;
};

/**
 * Converts a Google Consent Mode v2 consent value to a boolean.
 */
function toBoolean(value: 'granted' | 'denied' | boolean | undefined): boolean | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return value === 'granted';
}

/**
 * Converts Google Consent Mode v2 signals to Journify CategoryPreferences.
 *
 * Mapping:
 * - advertising: ad_storage AND ad_user_data AND ad_personalization (all three must be granted)
 * - analytics: analytics_storage
 * - functional: functionality_storage
 * - marketing: ad_storage
 * - personalization: personalization_storage
 *
 * @example
 * ```typescript
 * import { fromGoogleConsentV2 } from 'journify';
 *
 * journify.updateConsent(fromGoogleConsentV2({
 *     ad_storage: 'granted',
 *     ad_user_data: 'granted',
 *     ad_personalization: 'granted',
 *     analytics_storage: 'denied',
 *     functionality_storage: 'granted'
 * }));
 * ```
 */
export function fromGoogleConsentV2(googleConsent: GoogleConsentV2): CategoryPreferences {
    const preferences: CategoryPreferences = {};

    const adStorage = toBoolean(googleConsent.ad_storage);
    const adUserData = toBoolean(googleConsent.ad_user_data);
    const adPersonalization = toBoolean(googleConsent.ad_personalization);
    const analyticsStorage = toBoolean(googleConsent.analytics_storage);
    const functionalityStorage = toBoolean(googleConsent.functionality_storage);
    const personalizationStorage = toBoolean(googleConsent.personalization_storage);

    // Advertising requires all three: ad_storage, ad_user_data, and ad_personalization
    if (adStorage !== undefined && adUserData !== undefined && adPersonalization !== undefined) {
        preferences.advertising = adStorage && adUserData && adPersonalization;
    }

    // Analytics maps directly to analytics_storage
    if (analyticsStorage !== undefined) {
        preferences.analytics = analyticsStorage;
    }

    // Functional maps to functionality_storage
    if (functionalityStorage !== undefined) {
        preferences.functional = functionalityStorage;
    }

    // Marketing maps to ad_storage
    if (adStorage !== undefined) {
        preferences.marketing = adStorage;
    }

    // Personalization maps to personalization_storage
    if (personalizationStorage !== undefined) {
        preferences.personalization = personalizationStorage;
    }

    return preferences;
}
