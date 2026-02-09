import {Consent, ConsentService, CategoryPreferences, ConsentState} from "../../lib/domain/consent";

export class ConsentServiceMock implements ConsentService {
    public funcs: ConsentServiceMockFuncs;
    private consent: Consent = { categoryPreferences: {} };
    private consentState: ConsentState = {
        consentMode: 'relaxed',
        consent: this.consent,
        country: 'MA'
    };

    public constructor(funcs?: ConsentServiceMockFuncs) {
        this.funcs = funcs || {};
    }

    updateConsent(categoryPreferences: CategoryPreferences): void {
        if (this.funcs?.updateConsent) {
            this.funcs.updateConsent(categoryPreferences);
        }
    }

    hasConsent(categories: string[]): boolean {
        if (this.funcs?.hasConsent) {
            return this.funcs.hasConsent(categories);
        }
        return true;
    }

    getConsentState(): ConsentState {
        if (this.funcs?.getConsentState) {
            return this.funcs.getConsentState();
        }
        return this.consentState;
    }

    setConsent(consent: Consent): void {
        this.consent = consent;
    }
}

export interface ConsentServiceMockFuncs {
    updateConsent?: jest.Func;
    hasConsent?: jest.Func;
    getConsentState?: jest.Func;
}
