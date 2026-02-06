import {ConsentServiceImpl, CategoryPreferences} from "../consent";

describe("ConsentServiceImpl class", () => {
    describe("constructor", () => {
        describe("consent mode determination based on country", () => {
            it("Should use 'strict' mode for GDPR countries (e.g., 'DE', 'FR', 'GB')", () => {
                const consentService = new ConsentServiceImpl('FR');

                // In strict mode with no config, hasConsent should return false
                expect(consentService.hasConsent(['analytics'])).toBe(false);
            })

            it("Should use 'relaxed' mode for non-GDPR countries (e.g., 'US', 'SA')", () => {
                const consentService = new ConsentServiceImpl('SA');

                // In relaxed mode with no config, hasConsent should return true
                expect(consentService.hasConsent(['analytics'])).toBe(true);
            })

            it("Should use 'relaxed' mode for empty/undefined country", () => {
                let consentService = new ConsentServiceImpl('');
                expect(consentService.hasConsent(['analytics'])).toBe(true);

                consentService = new ConsentServiceImpl(undefined);
                expect(consentService.hasConsent(['analytics'])).toBe(true);
            })

            it("Should normalize lowercase country codes", () => {
                // GDPR countries in lowercase should still trigger strict mode
                let consentService = new ConsentServiceImpl('fr');
                expect(consentService.hasConsent(['analytics'])).toBe(false);

                consentService = new ConsentServiceImpl('de');
                expect(consentService.hasConsent(['analytics'])).toBe(false);

                // Non-GDPR in lowercase should trigger relaxed mode
                consentService = new ConsentServiceImpl('us');
                expect(consentService.hasConsent(['analytics'])).toBe(true);
            })

            it("Should trim whitespace from country codes", () => {
                let consentService = new ConsentServiceImpl(' FR ');
                expect(consentService.hasConsent(['analytics'])).toBe(false);

                consentService = new ConsentServiceImpl('  DE');
                expect(consentService.hasConsent(['analytics'])).toBe(false);

                consentService = new ConsentServiceImpl('US  ');
                expect(consentService.hasConsent(['analytics'])).toBe(true);
            })

            it("Should include country in consent object", () => {
                const consentService = new ConsentServiceImpl('FR');
                const consent = consentService.getConsent();

                expect(consent.country).toBe('FR');
            })
        })

        describe("initial consent", () => {
            it("Should initialize with empty consent when no initialConsent provided", () => {
                const consentService = new ConsentServiceImpl('US');

                const consent = consentService.getConsent();

                expect(consent).toBeDefined();
                expect(consent.categoryPreferences).toEqual({});
                expect(consent.country).toBe('US');
            })

            it("Should apply initialConsent for standard categories", () => {
                const initialConsent: CategoryPreferences = {
                    advertising: false,
                    analytics: true,
                };
                const consentService = new ConsentServiceImpl('FR', initialConsent);

                const consent = consentService.getConsent();

                expect(consent).toBeDefined();
                expect(consent.categoryPreferences).toEqual({
                    advertising: false,
                    analytics: true,
                });
                expect(consent.country).toBe('FR');
            })

            it("Should apply all standard category types", () => {
                const initialConsent: CategoryPreferences = {
                    advertising: true,
                    analytics: true,
                    functional: true,
                    marketing: false,
                    personalization: true,
                };
                const consentService = new ConsentServiceImpl('FR', initialConsent);

                const consent = consentService.getConsent();

                expect(consent.categoryPreferences).toEqual({
                    advertising: true,
                    analytics: true,
                    functional: true,
                    marketing: false,
                    personalization: true,
                });
            })

            it("Should not modify original initialConsent object", () => {
                const initialConsent: CategoryPreferences = {
                    analytics: true,
                };
                const consentService = new ConsentServiceImpl('FR', initialConsent);

                consentService.updateConsent({ analytics: false });

                expect(initialConsent.analytics).toBe(true);
                expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);
            })
        })
    })
})

describe("ConsentService interface", () => {
    describe("updateConsent method", () => {
        it("Should update consent values for standard categories", () => {
            const initialConsent: CategoryPreferences = {
                advertising: false,
                analytics: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(false);
            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);

            consentService.updateConsent({ advertising: true });

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(true);
            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);
        })

        it("Should add new categories that weren't in initial consent", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            consentService.updateConsent({ advertising: true, marketing: false });

            expect(consentService.getConsent().categoryPreferences).toEqual({
                analytics: true,
                advertising: true,
                marketing: false,
            });
        })

        it("Should update multiple categories at once", () => {
            const initialConsent: CategoryPreferences = {
                advertising: false,
                analytics: false,
                marketing: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            consentService.updateConsent({
                advertising: true,
                analytics: true,
            });

            expect(consentService.getConsent().categoryPreferences).toEqual({
                advertising: true,
                analytics: true,
                marketing: false,
            });
        })

        it("Should ignore invalid category names", () => {
            const consentService = new ConsentServiceImpl('FR', { analytics: true });

            // TypeScript would catch this, but testing runtime behavior
            consentService.updateConsent({ invalid_category: true } as CategoryPreferences);

            expect(consentService.getConsent().categoryPreferences).toEqual({
                analytics: true,
            });
        })
    })

    describe("hasConsent method", () => {
        // Strict mode tests (GDPR country)
        it("Should return false in strict mode when no categories configured", () => {
            const consentService = new ConsentServiceImpl('FR');

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return false in strict mode when category is undefined", () => {
            const initialConsent: CategoryPreferences = {
                advertising: true,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return false when category is explicitly false", () => {
            const initialConsent: CategoryPreferences = {
                analytics: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return true when all required categories are true", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
                advertising: true,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })

        it("Should return false when any required category is false", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
                advertising: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(false);
        })

        it("Should return false in strict mode when destination categories are empty or undefined", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            expect(consentService.hasConsent([])).toBe(false);
            expect(consentService.hasConsent(undefined)).toBe(false);
            expect(consentService.hasConsent(null)).toBe(false);
        })

        // Relaxed mode tests (non-GDPR country)
        it("Should return true in relaxed mode when no categories configured", () => {
            const consentService = new ConsentServiceImpl('US');

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })

        it("Should return true in relaxed mode when category is undefined", () => {
            const initialConsent: CategoryPreferences = {
                advertising: true,
            };
            const consentService = new ConsentServiceImpl('US', initialConsent);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })

        it("Should return false in relaxed mode when category is explicitly false", () => {
            const initialConsent: CategoryPreferences = {
                analytics: false,
            };
            const consentService = new ConsentServiceImpl('US', initialConsent);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return true in relaxed mode when destination categories are empty or undefined", () => {
            const initialConsent: CategoryPreferences = {
                analytics: false,
            };
            const consentService = new ConsentServiceImpl('US', initialConsent);

            expect(consentService.hasConsent([])).toBe(true);
            expect(consentService.hasConsent(undefined)).toBe(true);
            expect(consentService.hasConsent(null)).toBe(true);
        })

        it("Should return true in relaxed mode when some categories are true and others undefined", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
            };
            const consentService = new ConsentServiceImpl('US', initialConsent);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })
    })

    describe("getConsent method", () => {
        it("Should return the current consent object with country", () => {
            const initialConsent: CategoryPreferences = {
                analytics: true,
                advertising: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            const consent = consentService.getConsent();

            expect(consent).toEqual({
                categoryPreferences: {
                    analytics: true,
                    advertising: false,
                },
                country: 'FR'
            });
        })

        it("Should reflect updates made via updateConsent", () => {
            const initialConsent: CategoryPreferences = {
                analytics: false,
            };
            const consentService = new ConsentServiceImpl('FR', initialConsent);

            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);

            consentService.updateConsent({ analytics: true });

            expect(consentService.getConsent().categoryPreferences.analytics).toBe(true);
        })
    })
})
