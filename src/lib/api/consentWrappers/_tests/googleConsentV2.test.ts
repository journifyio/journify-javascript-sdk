import { fromGoogleConsentV2, GoogleConsentV2 } from "../googleConsentV2";
import { ConsentPreference } from "../../../domain/consent";

describe("fromGoogleConsentV2", () => {
    describe("analytics mapping (analytics_storage)", () => {
        it("should map analytics_storage 'granted' to analytics: GRANTED", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'granted' });
            expect(result.analytics).toBe(ConsentPreference.GRANTED);
        });

        it("should map analytics_storage 'denied' to analytics: DENIED", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'denied' });
            expect(result.analytics).toBe(ConsentPreference.DENIED);
        });

        it("should map analytics_storage true to analytics: GRANTED", () => {
            const result = fromGoogleConsentV2({ analytics_storage: true });
            expect(result.analytics).toBe(ConsentPreference.GRANTED);
        });

        it("should map analytics_storage false to analytics: DENIED", () => {
            const result = fromGoogleConsentV2({ analytics_storage: false });
            expect(result.analytics).toBe(ConsentPreference.DENIED);
        });

        it("should set analytics to UNSPECIFIED when analytics_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.analytics).toBe(ConsentPreference.UNSPECIFIED);
        });
    });

    describe("functional mapping (functionality_storage)", () => {
        it("should map functionality_storage 'granted' to functional: GRANTED", () => {
            const result = fromGoogleConsentV2({ functionality_storage: 'granted' });
            expect(result.functional).toBe(ConsentPreference.GRANTED);
        });

        it("should map functionality_storage 'denied' to functional: DENIED", () => {
            const result = fromGoogleConsentV2({ functionality_storage: 'denied' });
            expect(result.functional).toBe(ConsentPreference.DENIED);
        });

        it("should set functional to UNSPECIFIED when functionality_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.functional).toBe(ConsentPreference.UNSPECIFIED);
        });
    });

    describe("personalization mapping (personalization_storage)", () => {
        it("should map personalization_storage 'granted' to personalization: GRANTED", () => {
            const result = fromGoogleConsentV2({ personalization_storage: 'granted' });
            expect(result.personalization).toBe(ConsentPreference.GRANTED);
        });

        it("should map personalization_storage 'denied' to personalization: DENIED", () => {
            const result = fromGoogleConsentV2({ personalization_storage: 'denied' });
            expect(result.personalization).toBe(ConsentPreference.DENIED);
        });

        it("should set personalization to UNSPECIFIED when personalization_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.personalization).toBe(ConsentPreference.UNSPECIFIED);
        });
    });

    describe("marketing mapping (ad_storage)", () => {
        it("should map ad_storage 'granted' to marketing: GRANTED", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'granted' });
            expect(result.marketing).toBe(ConsentPreference.GRANTED);
        });

        it("should map ad_storage 'denied' to marketing: DENIED", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'denied' });
            expect(result.marketing).toBe(ConsentPreference.DENIED);
        });

        it("should set marketing to UNSPECIFIED when ad_storage is undefined", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'granted' });
            expect(result.marketing).toBe(ConsentPreference.UNSPECIFIED);
        });
    });

    describe("advertising mapping (ad_storage AND ad_user_data AND ad_personalization)", () => {
        it("should set advertising: GRANTED when all three are granted", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.GRANTED);
        });

        it("should set advertising: DENIED when ad_storage is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'denied',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });

        it("should set advertising: DENIED when ad_user_data is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'denied',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });

        it("should set advertising: DENIED when ad_personalization is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'denied'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });

        it("should set advertising: DENIED when all three are denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });

        it("should set advertising to UNSPECIFIED when all three are missing", () => {
            const result = fromGoogleConsentV2({});
            expect(result.advertising).toBe(ConsentPreference.UNSPECIFIED);
        });

        it("should set advertising to DENIED when only some of the three are provided", () => {
            // Missing ad_user_data
            let result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);

            // Missing ad_storage
            result = fromGoogleConsentV2({
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);

            // Missing ad_personalization
            result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted'
            });
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });

        it("should handle boolean values for advertising signals", () => {
            const result = fromGoogleConsentV2({
                ad_storage: true,
                ad_user_data: true,
                ad_personalization: true
            });
            expect(result.advertising).toBe(ConsentPreference.GRANTED);

            const result2 = fromGoogleConsentV2({
                ad_storage: true,
                ad_user_data: false,
                ad_personalization: true
            });
            expect(result2.advertising).toBe(ConsentPreference.DENIED);
        });
    });

    describe("full consent object", () => {
        it("should map a complete Google Consent Mode v2 object", () => {
            const googleConsent: GoogleConsentV2 = {
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted',
                analytics_storage: 'denied',
                functionality_storage: 'granted',
                personalization_storage: 'denied',
            };

            const result = fromGoogleConsentV2(googleConsent);

            expect(result).toEqual({
                advertising: ConsentPreference.GRANTED,
                analytics: ConsentPreference.DENIED,
                functional: ConsentPreference.GRANTED,
                marketing: ConsentPreference.GRANTED,
                personalization: ConsentPreference.DENIED,
            });
        });

        it("should handle mixed boolean and string values", () => {
            const googleConsent: GoogleConsentV2 = {
                ad_storage: true,
                ad_user_data: 'granted',
                ad_personalization: true,
                analytics_storage: false,
                functionality_storage: 'denied',
            };

            const result = fromGoogleConsentV2(googleConsent);

            expect(result.advertising).toBe(ConsentPreference.GRANTED);
            expect(result.analytics).toBe(ConsentPreference.DENIED);
            expect(result.functional).toBe(ConsentPreference.DENIED);
            expect(result.marketing).toBe(ConsentPreference.GRANTED);
            expect(result.personalization).toBe(ConsentPreference.UNSPECIFIED);
        });

        it("should return all UNSPECIFIED when given empty input", () => {
            const result = fromGoogleConsentV2({});
            expect(result).toEqual({
                advertising: ConsentPreference.UNSPECIFIED,
                analytics: ConsentPreference.UNSPECIFIED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            });
        });

        it("should set marketing to GRANTED but advertising to DENIED when only ad_storage is provided", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'granted' });

            expect(result.marketing).toBe(ConsentPreference.GRANTED);
            expect(result.advertising).toBe(ConsentPreference.DENIED);
        });
    });
});
