import { Consent, ConsentService, CategoryPreferences } from "../../lib/domain/consent";

export class ConsentServiceMock implements ConsentService {
    public funcs: ConsentServiceMockFuncs;
    private consent: Consent = { categoryPreferences: {}, country: 'MA' };

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
    updateConsent?: jest.Func;
    hasConsent?: jest.Func;
    getConsent?: jest.Func;
}
