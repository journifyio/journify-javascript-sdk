import {ConsentCategoryPreferences, ConsentPreference} from "../../domain/consent";

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
 * Converts a Google Consent Mode v2 consent value to a ConsentPreference.
 */
function toConsentPreference(value: 'granted' | 'denied' | boolean | undefined): ConsentPreference {
    if (value === undefined) {
        return ConsentPreference.UNSPECIFIED;
    }
    const granted = typeof value === 'boolean' ? value : value === 'granted';
    return granted ? ConsentPreference.GRANTED : ConsentPreference.DENIED;
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
 * ```TypeScript
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
export function fromGoogleConsentV2(googleConsent: GoogleConsentV2): ConsentCategoryPreferences {
    const adStorage = toConsentPreference(googleConsent.ad_storage);
    const adUserData = toConsentPreference(googleConsent.ad_user_data);
    const adPersonalization = toConsentPreference(googleConsent.ad_personalization);

    // Advertising requires all three: ad_storage, ad_user_data, and ad_personalization
    const noneProvided = (adStorage === ConsentPreference.UNSPECIFIED
                                                && adUserData === ConsentPreference.UNSPECIFIED
                                                && adPersonalization === ConsentPreference.UNSPECIFIED);
    const allGranted = (adStorage === ConsentPreference.GRANTED
                                                && adUserData === ConsentPreference.GRANTED
                                                && adPersonalization === ConsentPreference.GRANTED);
    const advertising = (noneProvided ? ConsentPreference.UNSPECIFIED
                                                        : (allGranted ? ConsentPreference.GRANTED
                                                            : ConsentPreference.DENIED));

    return {
        advertising,
        analytics: toConsentPreference(googleConsent.analytics_storage),
        functional: toConsentPreference(googleConsent.functionality_storage),
        marketing: adStorage,
        personalization: toConsentPreference(googleConsent.personalization_storage),
    };
}
