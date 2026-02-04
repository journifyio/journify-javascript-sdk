import {getConsentMode, ConsentServiceImpl, ConsentConfiguration} from "../consent";

describe("getConsentMode function", () => {
    it("Should return 'strict' for GDPR countries (e.g., 'DE', 'FR', 'GB')", () => {
        const country = 'FR';
        const consentMode = getConsentMode(country);
        expect(consentMode).toBe('strict');
    })
    it("Should return 'relaxed' for non-GDPR countries (e.g., 'US', 'SA')", () => {
        const country = 'SA';
        const consentMode = getConsentMode(country);
        expect(consentMode).toBe('relaxed');
    })
    it("Should return 'relaxed' for empty/undefined country", () => {
        let consentMode = getConsentMode('');
        expect(consentMode).toBe('relaxed');

        consentMode = getConsentMode(undefined);
        expect(consentMode).toBe('relaxed');
    })
    it("Should normalize lowercase country codes", () => {
        expect(getConsentMode('fr')).toBe('strict');
        expect(getConsentMode('de')).toBe('strict');
        expect(getConsentMode('us')).toBe('relaxed');
    })
    it("Should trim whitespace from country codes", () => {
        expect(getConsentMode(' FR ')).toBe('strict');
        expect(getConsentMode('  DE')).toBe('strict');
        expect(getConsentMode('US  ')).toBe('relaxed');
    })
})

describe("ConsentServiceImpl class", () => {
    describe("constructor", () => {
        it("Should initialize with empty consent when no config provided", () => {
            const consentService = new ConsentServiceImpl('relaxed');

            const consent = consentService.getConsent();

            expect(consent).toBeDefined();
            expect(consent.categoryPreferences).toEqual({});
        })

        it("Should apply consentConfiguration and map categories correctly", () => {
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising"]},
                "C002": { granted: true, mapsTo: ["analytics"]},
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(consent).toBeDefined();
            expect(consent.categoryPreferences).toEqual({
                advertising: false,
                analytics: true,
            });
        })

        it("Should auto-map predefined category names without mapsTo", () => {
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(consent).toBeDefined();
            expect(consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });
        })

        it("Should warn and skip invalid custom categories without mapsTo", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "invalid_category": { granted: true },
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Invalid consent configuration: "invalid_category"')
            );
            expect(consent.categoryPreferences).toEqual({
                analytics: true,
            });

            warnSpy.mockRestore();
        })

        it("Should skip and warn when multiple custom categories map to same Journify category", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["advertising"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(consent.categoryPreferences).toEqual({
                advertising: true,
            });

            warnSpy.mockRestore();
        })

        it("Should skip custom category entirely when all mapsTo targets are already mapped", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising", "analytics"] },
                "C002": { granted: false, mapsTo: ["advertising", "analytics"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "analytics" is already mapped')
            );
            expect(consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: true,
            });

            warnSpy.mockRestore();
        })

        it("Should partially map when only some mapsTo targets are duplicates", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["advertising", "analytics"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });

            warnSpy.mockRestore();
        })

        it("Should skip and warn when predefined category name is mapped via mapsTo first", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["analytics"] },
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "analytics" is already mapped')
            );
            expect(consent.categoryPreferences).toEqual({
                analytics: true,
            });

            warnSpy.mockRestore();
        })

        it("Should warn and skip invalid categories in mapsTo", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["analytics", "invalid_category" as never] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('"invalid_category" in mapsTo for "C001" is not a valid Journify category')
            );
            expect(consent.categoryPreferences).toEqual({
                analytics: true,
            });

            warnSpy.mockRestore();
        })
    })
})

describe("ConsentService interface", () => {
    describe("updateConsentState method", () => {
        it("Should update consent values for mapped categories", () => {
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["analytics"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(false);
            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);

            consentService.updateConsentState({ "C001": true });

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(true);
            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);
        })

        it("Should update mappings when updatedMappings provided", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            consentService.updateConsentState(
                { "C001": true },
                { "C001": ["advertising"] }
            );

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(true);
        })

        it("Should do nothing when category has no mapping", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            consentService.updateConsentState({ "unmapped_category": true });

            expect(consentService.getConsent().categoryPreferences).toEqual({ analytics: false });
        })

        it("Should update all mapped Journify categories when custom category maps to multiple", () => {
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising", "marketing"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(false);
            expect(consentService.getConsent().categoryPreferences.marketing).toBe(false);

            consentService.updateConsentState({ "C001": true });

            expect(consentService.getConsent().categoryPreferences.advertising).toBe(true);
            expect(consentService.getConsent().categoryPreferences.marketing).toBe(true);
        })
    })

    describe("hasConsent method", () => {
        // Strict mode tests
        it("Should return false in strict mode when no categories configured", () => {
            const consentService = new ConsentServiceImpl('strict');

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return false in strict mode when category is undefined", () => {
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return false when category is explicitly false", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return true when all required categories are true", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })

        it("Should return false when any required category is false", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
                "advertising": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(false);
        })

        it("Should return false in strict mode when destination categories are empty or undefined", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            expect(consentService.hasConsent([])).toBe(false);
            expect(consentService.hasConsent(undefined)).toBe(false);
            expect(consentService.hasConsent(null)).toBe(false);
        })

        // Relaxed mode tests
        it("Should return true in relaxed mode when no categories configured", () => {
            const consentService = new ConsentServiceImpl('relaxed');

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })

        it("Should return true in relaxed mode when category is undefined", () => {
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })

        it("Should return false in relaxed mode when category is explicitly false", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return true in relaxed mode when destination categories are empty or undefined", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration);

            expect(consentService.hasConsent([])).toBe(true);
            expect(consentService.hasConsent(undefined)).toBe(true);
            expect(consentService.hasConsent(null)).toBe(true);
        })

        it("Should return true in relaxed mode when some categories are true and others undefined", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })
    })

    describe("getConsent method", () => {
        it("Should return the current consent object", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
                "advertising": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            const consent = consentService.getConsent();

            expect(consent).toEqual({
                categoryPreferences: {
                    analytics: true,
                    advertising: false,
                }
            });
        })

        it("Should reflect updates made via updateConsentState", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration);

            expect(consentService.getConsent().categoryPreferences.analytics).toBe(false);

            consentService.updateConsentState({ "analytics": true });

            expect(consentService.getConsent().categoryPreferences.analytics).toBe(true);
        })
    })
})