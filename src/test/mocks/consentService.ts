import { Consent, ConsentService, ConsentCategoryPreferences } from "../../lib/domain/consent";

export class ConsentServiceMock implements ConsentService {
    public funcs: ConsentServiceMockFuncs;
    private consent: Consent = { categoryPreferences: {}};

    public constructor(funcs?: ConsentServiceMockFuncs) {
        this.funcs = funcs || {};
    }

    updateConsent(categoryPreferences: ConsentCategoryPreferences): void {
        if (this.funcs?.updateConsent) {
            this.funcs.updateConsent(categoryPreferences);
        }
    }

    hasConsent(destinationCategory: string): boolean {
        if (this.funcs?.hasConsent) {
            return this.funcs.hasConsent(destinationCategory);
        }
        return true;
    }

    getConsent(): Consent {
        if (this.funcs?.getConsent) {
            return this.funcs.getConsent();
        }
        return this.consent;
    }
}

export interface ConsentServiceMockFuncs {
    updateConsent?: jest.Func;
    hasConsent?: jest.Func;
    getConsent?: jest.Func;
}
