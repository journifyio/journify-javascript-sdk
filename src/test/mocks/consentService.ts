import { Consent, ConsentService, ConsentUpdate, CategoryPreferences } from "../../lib/domain/consent";

export class ConsentServiceMock implements ConsentService {
    public funcs: ConsentServiceMockFuncs;
    private consent: Consent = { categoryPreferences: {}, country: 'MA' };

    public constructor(funcs?: ConsentServiceMockFuncs) {
        this.funcs = funcs || {};
    }

    updateConsentState(
        consentUpdate: ConsentUpdate,
        updatedMappings?: { [key: string]: (keyof CategoryPreferences)[] }
    ): void {
        if (this.funcs?.updateConsentState) {
            this.funcs.updateConsentState(consentUpdate, updatedMappings);
        }
    }

    hasConsent(categories: string[]): boolean {
        if (this.funcs?.hasConsent) {
            return this.funcs.hasConsent(categories);
        }
        return true;
    }

    getConsent(): Consent {
        if (this.funcs?.getConsent) {
            return this.funcs.getConsent();
        }
        return this.consent;
    }

    setConsent(consent: Consent): void {
        this.consent = consent;
    }
}

export interface ConsentServiceMockFuncs {
    updateConsentState?: jest.Func;
    hasConsent?: jest.Func;
    getConsent?: jest.Func;
}