import {getConsentMode, ConsentServiceImpl, ConsentState, ConsentConfiguration} from "../consent";
import {createStoresForTest} from "../../../test/helpers/stores";
import {CONSENT_STATE_PERSISTENCE_KEY} from "../../store/store";

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
    it("Should return 'relaxed' for invalid country codes", () => {
        const country = 'XYZ';
        const consentMode = getConsentMode(country);
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
            const testStores = createStoresForTest();
            new ConsentServiceImpl('relaxed', undefined, testStores.local);

            const persistedState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(persistedState).toBeDefined();
            expect(persistedState.consentMode).toBe('relaxed');
            expect(persistedState.consent).toEqual({ categoryPreferences: {} });
            expect(persistedState.categoryMappings).toEqual({});
        })
        it("Should work without a store (no errors thrown)", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };

            expect(() => {
                new ConsentServiceImpl('strict', consentConfiguration, undefined);
            }).not.toThrow();
        })
        it("Should apply consentConfiguration and map categories correctly", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising"]},
                "C002": { granted: true, mapsTo: ["analytics"]},
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const persistedState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(persistedState).toBeDefined();
            expect(persistedState.consentMode).toBe('strict');
            expect(persistedState.categoryMappings).toEqual({
                "C001": ["advertising"],
                "C002": ["analytics"],
            });
            expect(persistedState.consent.categoryPreferences).toEqual({
                advertising: false,
                analytics: true,
            });
        })
        it("Should auto-map predefined category names without mapsTo", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
                "analytics": { granted: false },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const persistedState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(persistedState).toBeDefined();
            expect(persistedState.consentMode).toBe('strict');
            expect(persistedState.categoryMappings).toEqual({
                "advertising": ["advertising"],
                "analytics": ["analytics"],
            });
            expect(persistedState.consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });

        })
        it("Should warn and skip invalid custom categories without mapsTo", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "invalid_category": { granted: true },
                "analytics": { granted: true },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const persistedState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Invalid consent configuration: "invalid_category"')
            );
            expect(persistedState.categoryMappings).toEqual({
                "analytics": ["analytics"],
            });
            expect(persistedState.consent.categoryPreferences).toEqual({
                analytics: true,
            });

            warnSpy.mockRestore();
        })
        it("Should preserve persisted consent from store", () => {
            const testStores = createStoresForTest();

            const persistedState: ConsentState = {
                consentMode: 'strict',
                consent: {
                    categoryPreferences: {
                        advertising: true,
                        analytics: false,
                    }
                },
                categoryMappings: {
                    "C001": ["advertising"],
                    "C002": ["analytics"],
                }
            };
            testStores.local.set(CONSENT_STATE_PERSISTENCE_KEY, persistedState);

            new ConsentServiceImpl('strict', undefined, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(consentState).toBeDefined();
            expect(consentState.consentMode).toBe('strict');
            expect(consentState.consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });
            expect(consentState.categoryMappings).toEqual({
                "C001": ["advertising"],
                "C002": ["analytics"],
            });
        })
        it("Should update consentMode while preserving consent when mode changes", () => {
            const testStores = createStoresForTest();

            const persistedState: ConsentState = {
                consentMode: 'strict',
                consent: {
                    categoryPreferences: {
                        advertising: true,
                        analytics: false,
                    }
                },
                categoryMappings: {
                    "C001": ["advertising"],
                    "C002": ["analytics"],
                }
            };
            testStores.local.set(CONSENT_STATE_PERSISTENCE_KEY, persistedState);

            new ConsentServiceImpl('relaxed', undefined, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(consentState).toBeDefined();
            expect(consentState.consentMode).toBe('relaxed');
            expect(consentState.consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });
            expect(consentState.categoryMappings).toEqual({
                "C001": ["advertising"],
                "C002": ["analytics"],
            });
        })
        it("Should skip and warn when multiple custom categories map to same Journify category", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["advertising"] },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(consentState.categoryMappings).toEqual({
                "C001": ["advertising"],
            });
            expect(consentState.consent.categoryPreferences).toEqual({
                advertising: true,
            });

            warnSpy.mockRestore();
        })

        it("Should skip custom category entirely when all mapsTo targets are already mapped", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising", "analytics"] },
                "C002": { granted: false, mapsTo: ["advertising", "analytics"] },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "analytics" is already mapped')
            );
            expect(consentState.categoryMappings).toEqual({
                "C001": ["advertising", "analytics"],
            });
            expect(consentState.consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: true,
            });

            warnSpy.mockRestore();
        })

        it("Should partially map when only some mapsTo targets are duplicates", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["advertising", "analytics"] },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "advertising" is already mapped')
            );
            expect(consentState.categoryMappings).toEqual({
                "C001": ["advertising"],
                "C002": ["analytics"],
            });
            expect(consentState.consent.categoryPreferences).toEqual({
                advertising: true,
                analytics: false,
            });

            warnSpy.mockRestore();
        })
        it("Should skip and warn when predefined category name is mapped via mapsTo first", () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: true, mapsTo: ["analytics"] },
                "analytics": { granted: false },
            };
            new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Category "analytics" is already mapped')
            );
            expect(consentState.categoryMappings).toEqual({
                "C001": ["analytics"],
            });
            expect(consentState.consent.categoryPreferences).toEqual({
                analytics: true,
            });

            warnSpy.mockRestore();
        })
    })
})

describe("ConsentService interface", () => {
    describe("updateConsentState method", () => {
        it("Should update consent values for mapped categories", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising"] },
                "C002": { granted: false, mapsTo: ["analytics"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            let consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.consent.categoryPreferences.advertising).toBe(false);
            expect(consentState.consent.categoryPreferences.analytics).toBe(false);

            consentService.updateConsentState({ "C001": true });

            consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.consent.categoryPreferences.advertising).toBe(true);
            expect(consentState.consent.categoryPreferences.analytics).toBe(false);
        })
        it("Should update mappings when updatedMappings provided", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            let consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.categoryMappings).toEqual({ "analytics": ["analytics"] });

            consentService.updateConsentState(
                { "C001": true },
                { "C001": ["advertising"] }
            );

            consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.categoryMappings).toEqual({
                "analytics": ["analytics"],
                "C001": ["advertising"],
            });
            expect(consentState.consent.categoryPreferences.advertising).toBe(true);
        })
        it("Should persist updated consent to store", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            consentService.updateConsentState({ "analytics": true });

            const newConsentService = new ConsentServiceImpl('strict', undefined, testStores.local);
            const result = newConsentService.hasConsent(['analytics']);

            expect(result).toBe(true);
        })
        it("Should do nothing when category has no mapping", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            consentService.updateConsentState({ "unmapped_category": true });

            const consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.consent.categoryPreferences).toEqual({ analytics: false });
            expect(consentState.categoryMappings).toEqual({ "analytics": ["analytics"] });
        })
        it("Should update all mapped Journify categories when custom category maps to multiple", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "C001": { granted: false, mapsTo: ["advertising", "marketing"] },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            let consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.consent.categoryPreferences.advertising).toBe(false);
            expect(consentState.consent.categoryPreferences.marketing).toBe(false);

            consentService.updateConsentState({ "C001": true });

            consentState = testStores.local.get<ConsentState>(CONSENT_STATE_PERSISTENCE_KEY);
            expect(consentState.consent.categoryPreferences.advertising).toBe(true);
            expect(consentState.consent.categoryPreferences.marketing).toBe(true);
        })
    })
    describe("hasConsent method", () => {
        // Strict mode tests
        it("Should return false in strict mode when no categories configured", () => {
            const testStores = createStoresForTest();
            const consentService = new ConsentServiceImpl('strict', undefined, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })
        it("Should return false in strict mode when category is undefined", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })
        it("Should return false when category is explicitly false", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })
        it("Should return true when all required categories are true", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })
        it("Should return false when any required category is false", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
                "advertising": { granted: false },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            // One true, one false - should return false
            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(false);
        })
        it("Should return false in strict mode when destination categories are empty or undefined", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, testStores.local);

            expect(consentService.hasConsent([])).toBe(false);
            expect(consentService.hasConsent(undefined)).toBe(false);
            expect(consentService.hasConsent(null)).toBe(false);
        })
        // Relaxed mode tests
        it("Should return true in relaxed mode when no categories configured", () => {
            const testStores = createStoresForTest();
            const consentService = new ConsentServiceImpl('relaxed', undefined, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })
        it("Should return true in relaxed mode when category is undefined", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "advertising": { granted: true },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(true);
        })
        it("Should return false in relaxed mode when category is explicitly false", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics']);
            expect(result).toBe(false);
        })

        it("Should return true in relaxed mode when destination categories are empty or undefined", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: false },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration, testStores.local);

            expect(consentService.hasConsent([])).toBe(true);
            expect(consentService.hasConsent(undefined)).toBe(true);
            expect(consentService.hasConsent(null)).toBe(true);
        })
        it("Should return true in relaxed mode when some categories are true and others undefined", () => {
            const testStores = createStoresForTest();
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('relaxed', consentConfiguration, testStores.local);

            const result = consentService.hasConsent(['analytics', 'advertising']);
            expect(result).toBe(true);
        })
        it("Should work correctly without a store", () => {
            const consentConfiguration: ConsentConfiguration = {
                "analytics": { granted: true },
            };
            const consentService = new ConsentServiceImpl('strict', consentConfiguration, undefined);

            expect(consentService.hasConsent(['analytics'])).toBe(true);
            expect(consentService.hasConsent(['advertising'])).toBe(false);
        })
    })
})