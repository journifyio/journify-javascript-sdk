import { fromGoogleConsentV2, GoogleConsentV2 } from "../googleConsentV2";

describe("fromGoogleConsentV2", () => {
    describe("analytics mapping (analytics_storage)", () => {
        it("should map analytics_storage 'granted' to analytics: true", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'granted' });
            expect(result.analytics).toBe(true);
        });

        it("should map analytics_storage 'denied' to analytics: false", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'denied' });
            expect(result.analytics).toBe(false);
        });

        it("should map analytics_storage true to analytics: true", () => {
            const result = fromGoogleConsentV2({ analytics_storage: true });
            expect(result.analytics).toBe(true);
        });

        it("should map analytics_storage false to analytics: false", () => {
            const result = fromGoogleConsentV2({ analytics_storage: false });
            expect(result.analytics).toBe(false);
        });

        it("should not set analytics when analytics_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.analytics).toBeUndefined();
        });
    });

    describe("functional mapping (functionality_storage)", () => {
        it("should map functionality_storage 'granted' to functional: true", () => {
            const result = fromGoogleConsentV2({ functionality_storage: 'granted' });
            expect(result.functional).toBe(true);
        });

        it("should map functionality_storage 'denied' to functional: false", () => {
            const result = fromGoogleConsentV2({ functionality_storage: 'denied' });
            expect(result.functional).toBe(false);
        });

        it("should not set functional when functionality_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.functional).toBeUndefined();
        });
    });

    describe("personalization mapping (personalization_storage)", () => {
        it("should map personalization_storage 'granted' to personalization: true", () => {
            const result = fromGoogleConsentV2({ personalization_storage: 'granted' });
            expect(result.personalization).toBe(true);
        });

        it("should map personalization_storage 'denied' to personalization: false", () => {
            const result = fromGoogleConsentV2({ personalization_storage: 'denied' });
            expect(result.personalization).toBe(false);
        });

        it("should not set personalization when personalization_storage is undefined", () => {
            const result = fromGoogleConsentV2({});
            expect(result.personalization).toBeUndefined();
        });
    });

    describe("marketing mapping (ad_storage)", () => {
        it("should map ad_storage 'granted' to marketing: true", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'granted' });
            expect(result.marketing).toBe(true);
        });

        it("should map ad_storage 'denied' to marketing: false", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'denied' });
            expect(result.marketing).toBe(false);
        });

        it("should not set marketing when ad_storage is undefined", () => {
            const result = fromGoogleConsentV2({ analytics_storage: 'granted' });
            expect(result.marketing).toBeUndefined();
        });
    });

    describe("advertising mapping (ad_storage AND ad_user_data AND ad_personalization)", () => {
        it("should set advertising: true when all three are granted", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(true);
        });

        it("should set advertising: false when ad_storage is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'denied',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(false);
        });

        it("should set advertising: false when ad_user_data is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'denied',
                ad_personalization: 'granted'
            });
            expect(result.advertising).toBe(false);
        });

        it("should set advertising: false when ad_personalization is denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'denied'
            });
            expect(result.advertising).toBe(false);
        });

        it("should set advertising: false when all three are denied", () => {
            const result = fromGoogleConsentV2({
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
            expect(result.advertising).toBe(false);
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
            expect(result.advertising).toBe(true);

            const result2 = fromGoogleConsentV2({
                ad_storage: true,
                ad_user_data: false,
                ad_personalization: true
            });
            expect(result2.advertising).toBe(false);
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
                advertising: true,
                analytics: false,
                functional: true,
                marketing: true,
                personalization: false,
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

            expect(result.advertising).toBe(true);
            expect(result.analytics).toBe(false);
            expect(result.functional).toBe(false);
            expect(result.marketing).toBe(true);
        });

        it("should return empty object when given empty input", () => {
            const result = fromGoogleConsentV2({});
            expect(result).toEqual({});
        });

        it("should set marketing but not advertising when only ad_storage is provided", () => {
            const result = fromGoogleConsentV2({ ad_storage: 'granted' });

            expect(result.marketing).toBe(true);
            expect(result.advertising).toBeUndefined();
        });
    });
});
