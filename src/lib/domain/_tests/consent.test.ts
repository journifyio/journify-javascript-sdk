import {ConsentServiceImpl, ConsentCategoryPreferences, ConsentPreference, resolveConsentMode} from "../consent";

describe("resolveConsentMode function", () => {
    describe("workspace consent mode", () => {
        it("Should return workspace consent mode when provided, regardless of country", () => {
            expect(resolveConsentMode('US', 'STRICT')).toBe('STRICT');
            expect(resolveConsentMode('FR', 'RELAXED')).toBe('RELAXED');
        })

        it("Should return workspace consent mode when country is undefined", () => {
            expect(resolveConsentMode(undefined, 'STRICT')).toBe('STRICT');
            expect(resolveConsentMode(undefined, 'RELAXED')).toBe('RELAXED');
        })
    })

    describe("country-based fallback", () => {
        it("Should return 'STRICT' for GDPR countries", () => {
            expect(resolveConsentMode('FR')).toBe('STRICT');
            expect(resolveConsentMode('DE')).toBe('STRICT');
            expect(resolveConsentMode('GB')).toBe('STRICT');
        })

        it("Should return 'RELAXED' for non-GDPR countries", () => {
            expect(resolveConsentMode('US')).toBe('RELAXED');
            expect(resolveConsentMode('SA')).toBe('RELAXED');
        })

        it("Should return 'RELAXED' for empty or undefined country", () => {
            expect(resolveConsentMode('')).toBe('RELAXED');
            expect(resolveConsentMode(undefined)).toBe('RELAXED');
        })

        it("Should normalize lowercase country codes", () => {
            expect(resolveConsentMode('fr')).toBe('STRICT');
            expect(resolveConsentMode('de')).toBe('STRICT');
            expect(resolveConsentMode('us')).toBe('RELAXED');
        })

        it("Should trim whitespace from country codes", () => {
            expect(resolveConsentMode(' FR ')).toBe('STRICT');
            expect(resolveConsentMode('  DE')).toBe('STRICT');
            expect(resolveConsentMode('US  ')).toBe('RELAXED');
        })
    })
})

describe("ConsentServiceImpl class", () => {
    describe("constructor", () => {
        describe("initial consent", () => {
            it("Should initialize with all UNSPECIFIED when no initialConsent provided", () => {
                const consentService = new ConsentServiceImpl('RELAXED');

                const consent = consentService.getConsent();

                expect(consent).toBeDefined();
                expect(consent.categoryPreferences).toEqual({
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.UNSPECIFIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                });
            })

            it("Should apply initialConsent for standard categories", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.DENIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

                expect(consentService.getConsent().categoryPreferences).toEqual({
                    advertising: ConsentPreference.DENIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                });
            })

            it("Should not modify original initialConsent object", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

                consentService.updateConsent({
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.DENIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                });

                expect(initialConsent.analytics).toBe(ConsentPreference.GRANTED);
                expect(consentService.getConsent().categoryPreferences.analytics).toBe(ConsentPreference.DENIED);
            })
        })
    })

    describe("updateConsent method", () => {
        it("Should update consent values for standard categories", () => {
            const initialConsent: ConsentCategoryPreferences = {
                advertising: ConsentPreference.DENIED,
                analytics: ConsentPreference.DENIED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            };
            const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

            consentService.updateConsent({
                advertising: ConsentPreference.GRANTED,
                analytics: ConsentPreference.DENIED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            });

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(ConsentPreference.GRANTED);
            expect(consentService.getConsent().categoryPreferences.analytics).toBe(ConsentPreference.DENIED);
        })

        it("Should ignore invalid category names", () => {
            const initialConsent: ConsentCategoryPreferences = {
                advertising: ConsentPreference.UNSPECIFIED,
                analytics: ConsentPreference.GRANTED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            };
            const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

            // TypeScript would catch this, but testing runtime behavior
            consentService.updateConsent({ invalid_category: ConsentPreference.GRANTED } as unknown as ConsentCategoryPreferences);

            expect(consentService.getConsent().categoryPreferences).toEqual({
                advertising: ConsentPreference.UNSPECIFIED,
                analytics: ConsentPreference.GRANTED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            });
        })
    })

    describe("hasConsent method", () => {
        describe("strict mode", () => {
            it("Should return false when no categories configured", () => {
                const consentService = new ConsentServiceImpl('STRICT');

                expect(consentService.hasConsent('ANALYTICS')).toBe(false);
            })

            it("Should return false when category is UNSPECIFIED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.GRANTED,
                    analytics: ConsentPreference.UNSPECIFIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('STRICT', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(false);
            })


            it("Should return true when category is explicitly GRANTED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('STRICT', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(true);
            })

            it("Should return false when category is explicitly DENIED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.DENIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('STRICT', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(false);
            })
        })

        describe("relaxed mode", () => {
            it("Should return true when no categories configured", () => {
                const consentService = new ConsentServiceImpl('RELAXED');

                expect(consentService.hasConsent('ANALYTICS')).toBe(true);
            })

            it("Should return true when category is UNSPECIFIED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.GRANTED,
                    analytics: ConsentPreference.UNSPECIFIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(true);
            })


            it("Should return true when category is GRANTED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(true);
            })

            it("Should return false when category is explicitly DENIED", () => {
                const initialConsent: ConsentCategoryPreferences = {
                    advertising: ConsentPreference.UNSPECIFIED,
                    analytics: ConsentPreference.DENIED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                };
                const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

                expect(consentService.hasConsent('ANALYTICS')).toBe(false);
            })
        })
    })

    describe("getConsent method", () => {
        it("Should return the current consent object", () => {
            const initialConsent: ConsentCategoryPreferences = {
                advertising: ConsentPreference.DENIED,
                analytics: ConsentPreference.GRANTED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            };
            const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

            expect(consentService.getConsent()).toEqual({
                categoryPreferences: {
                    advertising: ConsentPreference.DENIED,
                    analytics: ConsentPreference.GRANTED,
                    functional: ConsentPreference.UNSPECIFIED,
                    marketing: ConsentPreference.UNSPECIFIED,
                    personalization: ConsentPreference.UNSPECIFIED,
                },
            });
        })

        it("Should reflect updates made via updateConsent", () => {
            const initialConsent: ConsentCategoryPreferences = {
                advertising: ConsentPreference.UNSPECIFIED,
                analytics: ConsentPreference.DENIED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            };
            const consentService = new ConsentServiceImpl('RELAXED', initialConsent);

            consentService.updateConsent({
                advertising: ConsentPreference.UNSPECIFIED,
                analytics: ConsentPreference.GRANTED,
                functional: ConsentPreference.UNSPECIFIED,
                marketing: ConsentPreference.UNSPECIFIED,
                personalization: ConsentPreference.UNSPECIFIED,
            });

            expect(consentService.getConsent().categoryPreferences.analytics).toBe(ConsentPreference.GRANTED);
        })
    })
})
