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

        it("should not set analytics when analytics_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.analytics).toBeUndefined();
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

        it("should not set functional when functionality_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.functional).toBeUndefined();
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

        it("should not set personalization when personalization_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.personalization).toBeUndefined();
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

        it("should not set marketing when ad_storage is undefined", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'granted' });
            expect(result.marketing).toBeUndefined();
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

        it("should not set advertising when any of the three is undefined", () => {
            // Missing ad_user_data
            let result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBeUndefined();

            // Missing ad_storage
            result = fromGoogleConsentV2({
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBeUndefined();

            // Missing ad_personalization
            result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted'
            });
            expect(result.advertising).toBeUndefined();
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
        });

        it("should return empty object when given empty input", () => {
            const result = fromGoogleConsentV2({});
            expect(result).toEqual({});
        });

        it("should set marketing but not advertising when only ad_storage is provided", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'granted' });

            expect(result.marketing).toBe(ConsentPreference.GRANTED);
            expect(result.advertising).toBeUndefined();
        });
    });
});
